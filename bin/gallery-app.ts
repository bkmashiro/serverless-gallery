#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GalleryAppStack } from "../lib/eda-app-stack";

const app = new cdk.App();
new GalleryAppStack(app, "galleryStack", {
  env: { region: "eu-west-1" },
});
