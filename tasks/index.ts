import { task } from "hardhat/config";
import { deployAll } from "./deploy";

task(
  "deploy",
  "deploy all contracts by seller",
  deployAll
);