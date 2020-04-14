import Web3 from "web3";
/*import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Fortmatic from "fortmatic";
import Authereum from "authereum";
import BurnerConnectProvider from "@burner-wallet/burner-connect-provider";
*/
import Onboard from 'bnc-onboard'

import * as common from './utils/common.js'
import { contract, init as initContracts } from './contract.js'
import { infura_url } from './allabis.js'
import { multicall_address, multicall_abi } from './allabis'

/*const providerOptions = {
    walletconnect: {
        package: WalletConnectProvider, // required
        options: {
          infuraId: "c334bb4b45a444979057f0fb8a0c9d1b" // required
        }
    },
    authereum: {
        package: Authereum, // required
        options: {}
    },
    burnerconnect: {
        package: BurnerConnectProvider, // required
        options: {}
    },
    fortmatic: {
        package: Fortmatic, // required
        options: {
          key: "pk_live_190B10CE18F47DCD" // required
        }
    }
};*/

/*const web3Modal = new Web3Modal({
  network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions // required
});*/

export const onboard = Onboard({
  dappId: 'c68d8ec3-9b9a-4ba5-a3eb-6232eff79030',       // [String] The API key created by step one above
  networkId: 1,  // [Integer] The Ethereum network ID your Dapp uses.
  subscriptions: {
    wallet: wallet => {
       window.web3 = new Web3(wallet.provider)
       localStorage.setItem('selectedWallet', wallet.name)
    },
    network: network => {
      if(network != 1) {
        contract.error = 'Error: wrong network type. Please switch to mainnet';
        contract.showShares = false
        window.web3 = new Web3(infura_url)
      }
      else {
        contract.error = ''
        contract.showShares = true;
      }
    },
    address: account => {
      if(contract.default_account)
        common.update_fee_info()
      contract.default_account = account;
    }
  },
  walletSelect: {
      wallets: [
        { walletName: "metamask" },
        {
          walletName: "trezor",
          appUrl: "https://beta.curve.fi",
          email: "info@curve.fi",
          rpcUrl:
            "https://mainnet.infura.io/v3/c334bb4b45a444979057f0fb8a0c9d1b"
        },
        {
          walletName: "ledger",
          rpcUrl:
            "https://mainnet.infura.io/v3/c334bb4b45a444979057f0fb8a0c9d1b"
        },
        { walletName: "dapper" },
        { walletName: "coinbase" },
        { walletName: "status" },
        {
          walletName: "portis",
          apiKey: "a3bb2525-5101-4a9c-b300-febc6319c3b4"
        },
        { walletName: "fortmatic", apiKey: "pk_live_190B10CE18F47DCD" },
        { walletName: "torus" },
        { walletName: "squarelink", apiKey: "db2074f87c34f247593c" },
        { walletName: "authereum" },
        { walletName: "trust" },
        {
          walletName: "walletConnect",
          infuraKey: "c334bb4b45a444979057f0fb8a0c9d1b"
        },
        { walletName: "opera" },
        { walletName: "operaTouch" },
        { walletName: "unilogin" },
      ]
    },

});

async function init(contractName, init = true) {
  console.time('initswap')
	//try catch for checking cancel dialog
	//const provider = await web3Modal.connect();

	/*const web3 = new Web3(provider);
	window.web3 = web3;
  window.web3provider = web3;*/
  try {
    contract.currentName = contractName
    let userSelectedWallet = await onboard.walletSelect(localStorage.getItem('selectedWallet'));
    if(userSelectedWallet) await onboard.walletCheck();
    else window.web3 = new Web3(infura_url)
    contract.web3 = contract.web3 || window.web3
    contract.multicall = contract.multicall || new web3.eth.Contract(multicall_abi, multicall_address)
    if(!contract.default_account) contract.default_account = (await web3.eth.getAccounts())[0];
    if(init) await initContracts(contractName);
    console.timeEnd('initswap')
  }
  catch(err) {
    console.error(err)
  }

}

export default init;