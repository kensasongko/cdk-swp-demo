package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/secretsmanager"
	"os"
  "database/sql"
  "strings"
  _ "github.com/lib/pq"
)

type SecretData struct {
	DbClusterIdentifier string `json:"dbClusterIdentifier"`
	Password            string `json:"password"`
	MasterArn           string `json:"masterarn"`
	DbName              string `json:"dbname"`
	Engine              string `json:"engine"`
	Port                int    `json:"port"`
	Host                string `json:"host"`
	Username            string `json:"username"`
}

func HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
  rdsSecretData := getRdsSecret()

  sqlconn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", rdsSecretData.Host, rdsSecretData.Port, rdsSecretData.Username, rdsSecretData.Password, rdsSecretData.DbName)
  db, err := sql.Open("postgres", sqlconn)
  if err != nil {
    return events.APIGatewayProxyResponse{
      StatusCode: 200,
      Body:       fmt.Sprintf("{\"ErrOpen\": \"%s\"}", err),
    }, nil
  }


  err = db.Ping()
  if err != nil {
    return events.APIGatewayProxyResponse{
      StatusCode: 200,
      Body:       fmt.Sprintf("{\"ErrPing\": \"%s\"}", err),
    }, nil
  }

  defer db.Close()

  rows, err := db.Query(`SELECT "user_id", "name" FROM "users"`)
  if err != nil {
    return events.APIGatewayProxyResponse{
      StatusCode: 200,
      Body:       fmt.Sprintf("{\"ErrQuery\": \"%s\"}", err),
    }, nil
  }

  var sb strings.Builder

  defer rows.Close()
  for rows.Next() {
      var id int
      var name string

      err = rows.Scan(&id, &name)
      if err != nil {
        return events.APIGatewayProxyResponse{
          StatusCode: 200,
          Body:       fmt.Sprintf("{\"ErrScan\": \"%s\"}", err),
        }, nil
      }

      if sb.Len() == 0 {
        sb.WriteString("{\"users\": [")
      } else {
        sb.WriteString(",")
      }

      sb.WriteString(fmt.Sprintf("{\"id\": %d, \"name\": \"%s\"}", id, name))
  }
  if sb.Len() != 0 {
      sb.WriteString("]}");
  }

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
    Body:       sb.String(),
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
}

func getRdsSecret() (SecretData) {
  // Get secret ARN from user-defined env.
	secretName := os.Getenv("RDS_SECRET_ARN")
  // Get region from built-in env.
	region := os.Getenv("AWS_REGION")

	//Create a Secrets Manager client
	sess, err := session.NewSession()
	if err != nil {
		// Handle session creation error
		fmt.Println(err.Error())
    panic(err.Error())
	}
	svc := secretsmanager.New(sess,
		aws.NewConfig().WithRegion(region))
	input := &secretsmanager.GetSecretValueInput{
		SecretId:     aws.String(secretName),
		VersionStage: aws.String("AWSCURRENT"), // VersionStage defaults to AWSCURRENT if unspecified
	}

	// In this sample we only handle the specific exceptions for the 'GetSecretValue' API.
	// See https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html

	result, err := svc.GetSecretValue(input)
	if err != nil {
		if aerr, ok := err.(awserr.Error); ok {
			switch aerr.Code() {
			case secretsmanager.ErrCodeDecryptionFailure:
				// Secrets Manager can't decrypt the protected secret text using the provided KMS key.
				fmt.Println(secretsmanager.ErrCodeDecryptionFailure, aerr.Error())

			case secretsmanager.ErrCodeInternalServiceError:
				// An error occurred on the server side.
				fmt.Println(secretsmanager.ErrCodeInternalServiceError, aerr.Error())

			case secretsmanager.ErrCodeInvalidParameterException:
				// You provided an invalid value for a parameter.
				fmt.Println(secretsmanager.ErrCodeInvalidParameterException, aerr.Error())

			case secretsmanager.ErrCodeInvalidRequestException:
				// You provided a parameter value that is not valid for the current state of the resource.
				fmt.Println(secretsmanager.ErrCodeInvalidRequestException, aerr.Error())

			case secretsmanager.ErrCodeResourceNotFoundException:
				// We can't find the resource that you asked for.
				fmt.Println(secretsmanager.ErrCodeResourceNotFoundException, aerr.Error())
			}
		} else {
			// Print the error, cast err to awserr.Error to get the Code and
			// Message from an error.
			fmt.Println(err.Error())
		}
    panic(err.Error())
	}

	// Decrypts secret using the associated KMS key.
	// Depending on whether the secret is a string or binary, one of these fields will be populated.
	var secretString string
	if result.SecretString != nil {
		secretString = *result.SecretString
	}

	var secretData SecretData
	err = json.Unmarshal([]byte(secretString), &secretData)
	if err != nil {
		panic(err.Error())
	}

	return secretData
}
