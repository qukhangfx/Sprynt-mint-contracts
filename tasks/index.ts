import { task } from 'hardhat/config'
import { deployMainContracts } from '../scripts/deployMainContracts'

task(
  'deployMainContracts',
  'deploy factory contracts',
  deployMainContracts
).addParam('e', 'testnet or mainnet')