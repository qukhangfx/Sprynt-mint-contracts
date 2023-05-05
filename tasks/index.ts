import { task } from "hardhat/config";
import { deployMainContractsByAdmin } from "./deployMainContracts";
import { verifyMainContractsByAdmin } from "./verifyMainContracts";
import { deployChildContractsBySeller } from "./deployChildContracts";
import { verifyChildContractsBySeller } from "./verifyChildContracts";
import { setAllTrustRemotes } from "./setAllTrustRemotes";
import { depositTokenByClient } from "./depositTokenTest";

task(
  "deployMain",
  "deploy main factory contracts by admin",
  deployMainContractsByAdmin
).addParam("e", "testnet or mainnet", "testnet");

task(
  "verifyMain",
  "verify main factory contracts by admin",
  verifyMainContractsByAdmin
);

task(
  "setTrustRemote",
  "set all trust remotes to all main contracts by admin",
  setAllTrustRemotes
);

task(
  "deployChild",
  "deploy child contracts by seller",
  deployChildContractsBySeller
).addParam(
  "mchain",
  "child chain of ReceiveFactoryContract for NFT mint",
  "polygonMumbai"
);

task(
  "verifyChild",
  "verify child contracts by seller",
  verifyChildContractsBySeller
);

task(
  "depositTokenTest",
  "client deposits tokens and receives nfts",
  depositTokenByClient
)
  .addParam("dchain", "deposit chain", "sepolia")
  .addParam("mchain", "mint chain", "polygonMumbai")
  .addParam("bnonce", "backend nonce value", "0");
