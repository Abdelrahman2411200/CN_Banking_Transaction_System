terraform {
  backend "s3" {
    key     = "cn-banking/prod/terraform.tfstate"
    encrypt = true
  }
}
