terraform {
  backend "s3" {
    key     = "cn-banking/dev/terraform.tfstate"
    encrypt = true
  }
}
