"use client";

import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";

// Safely configure Amplify on the client side
Amplify.configure(outputs, { ssr: true });

export default function ConfigureAmplifyClientSide() {
  return null;
}
