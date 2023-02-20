import { task } from 'hardhat/config'
import { deployMainContractsByAdmin } from './deployMainContracts'
import { deployChildContractsBySeller } from './deployChildContracts'

task(
  'deployMain',
  'deploy main factory contracts by admin',
  deployMainContractsByAdmin
).addParam('e', 'testnet or mainnet', 'testnet')

task(
  'deployChild',
  'deploy child contracts by seller',
  deployChildContractsBySeller
).addParam('schains', 'child chains of DepositFactoryContract for lz-message send', 'goerli,polygonMumbai')
.addParam('dchain', 'child chain of ReceiveFactoryContract for NFT mint', 'polygonMumbai')