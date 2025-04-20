#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GalleryStack } from "../lib/gallery-stack";

const app = new cdk.App();
new GalleryStack(app, "galleryStack", {
  env: { region: "eu-west-1" },
});
