import Vue from "vue";
import * as BN from 'bignumber.js'
import allabis, { ERC20_abi, cERC20_abi, yERC20_abi } from './allabis'
import web3Init from './init'
import { chunkArr } from './utils/helpers'
import * as common from './utils/common.js'

var N_COINS = 2;
var coin_precisions = [1e18, 1e6];
var old_swap_address = '0x2e60CF74d81ac34eB21eEff58Db4D385920ef419';
var swap_address = '0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56';
var token_address = '0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2';
var old_token_address = '0x3740fb63ab7a09891d7c0d4299442A551D06F5fD';

export const LENDING_PRECISION = 1e18;
export const PRECISION = 1e18;

var migration_address = '0x54Ee22d5593FC76fB20EafAb66C45aAb3268B800';
export const infura_url = 'https://mainnet.infura.io/v3/c334bb4b45a444979057f0fb8a0c9d1b';

const currencies = {
	compound: {
		dai: 'cDAI',
		usdc: 'cUSDC'
	},
	usdt: {
		dai: 'cDAI',
		usdc: 'cUSDC',
		usdt: 'USDT'
	},
	iearn: {
		dai: 'yDAI',
		usdc: 'yUSDC',
		usdt: 'yUSDT',
		tusd: 'yTUSD'
	},
	busd: {
		dai: 'yDAI',
		usdc: 'yUSDC',
		usdt: 'yUSDT',
		busd: 'ybUSD'
	},
	susd: {
		susd: 'ySUSD',
		ycurve: 'yCurve',
	},
}

export const allCurrencies = currencies

export const poolMenu = {
	compound: 'Compound',
	usdt: 'USDT',
	iearn: 'Y',
	busd: 'bUSD',
	susd: 'sUSD-yCurve'
}

export const gas = {
	swap: {
		compound: {
			exchange: 600000,
			exchange_underlying: 1200000
		},
		usdt: {
			exchange: 600000,
			exchange_underlying: 1200000
		},
		iearn: {
			exchange: 800000,
			exchange_underlying: 1600000
		},
		busd: {
			exchange: 800000,
			exchange_underlying: 1600000
		},
		susd: {
			exchange: 1600000,
			exchange_underlying: 1600000,
			deposit_zap: 3000000,
		},
	},
	withdraw: {
		compound: {
			imbalance: x => 1000000,
		},
		usdt: {
			imbalance: x => 1000000,
		},
		iearn: {
			imbalance: x => (12642*x + 474068)*1.5,
		},
		busd: {
			imbalance: x => (12642*x + 474068)*1.5,
		},
		susd: {
			imbalance: x => 1000000,
		},
	},
	depositzap: {
		compound: {
			deposit: x => (172664*x + 471691)*1.5,
			withdraw: 1000000,
			withdrawShare: 1000000,
			withdrawImbalance: x => (181733*x + 506125)*1.5,
		},
		usdt: {
			//use periodic fit here?
			deposit: x => (93795.5*x + 608935)*1.5,
			withdraw: 1600000,
			withdrawShare: 1000000,
			withdrawImbalance: x => (97226.5*x + 671880)*1.5,
		},
		iearn: {
			deposit: x => (225377*x + 522674)*1.5,
			withdraw: 2000000,
			withdrawShare: 1600000,
			withdrawImbalance: x => (276069*x + 516861)*1.5,
		},
		busd: {
			deposit: x => (225377*x + 522674)*1.5,
			withdraw: 2000000,
			withdrawShare: 1600000,
			withdrawImbalance: x => (276069*x + 516861)*1.5,
		},
		susd: {
			withdrawImbalance: x => (276069*x + 516861)*1.5,
		},
	}
}

let initState = {
	initializedContracts: false,
	balances: [],
	wallet_balances: [],
	underlying_coins: [],
	c_rates: [],
	bal_info: [],
	total: 0,
	l_info: [],
	totalShare: 0,
	showShares: false,
	fee: null,
	admin_fee: null,
}

const state = Vue.observable({
	web3: null,
	multicall: null,
	allInitContracts: [],
	token_balance: 0,
	contracts: {
		compound: {
			currentName: 'compound', 
			initializedContracts: false,
			balances: [],
			wallet_balances: [],
			underlying_coins: [],
			c_rates: [],
			bal_info: [],
			total: 0,
			l_info: [],
			totalShare: 0,
			showShares: false,
			fee: null,
			admin_fee: null,
			oldBalance: 0,
		},
		usdt: {
			currentName: 'usdt', 
			initializedContracts: false,
			balances: [],
			wallet_balances: [],
			underlying_coins: [],
			c_rates: [],
			bal_info: [],
			total: 0,
			l_info: [],
			totalShare: 0,
			showShares: false,
			fee: null,
			admin_fee: null,
		},
		iearn: {
			currentName: 'iearn', 
			initializedContracts: false,
			balances: [],
			wallet_balances: [],
			underlying_coins: [],
			c_rates: [],
			bal_info: [],
			total: 0,
			l_info: [],
			totalShare: 0,
			showShares: false,
			fee: null,
			admin_fee: null,
		},
		busd: {
			currentName: 'busd', 
			initializedContracts: false,
			balances: [],
			wallet_balances: [],
			underlying_coins: [],
			c_rates: [],
			bal_info: [],
			total: 0,
			l_info: [],
			totalShare: 0,
			showShares: false,
			fee: null,
			admin_fee: null,
		},
		susd: {
			currentName: 'susd', 
			initializedContracts: false,
			balances: [],
			wallet_balances: [],
			underlying_coins: [],
			c_rates: [],
			bal_info: [],
			total: 0,
			l_info: [],
			totalShare: 0,
			showShares: false,
			fee: null,
			admin_fee: null,
		}
	},
	currentName: 'compound',
	get currentContract() {
		return this.contracts[this.currentName]
	},


	currencies: currencies.compound,
	N_COINS: N_COINS,
	coin_precisions: coin_precisions,
	wrapped_precisions: [],
	swap_address: swap_address,
	old_swap_address: old_swap_address,
	token_address: token_address,
	old_token_address: old_token_address,
	migration_address: migration_address,
	infura_url: infura_url,

	coins: new Array(N_COINS),
	underlying_coins: new Array(N_COINS),
	swap: null,
	old_swap: null,
	swap_token: null,
	old_swap_token: null,
	ERC20Contract: null,
	balances: new Array(N_COINS),
	wallet_balances: new Array(N_COINS),
	fee: 0,
	admin_fee: 0,
	trade_timeout: 1800,
	max_allowance: BN(2).pow(BN(256)).minus(BN(1)),
	coins: [],
	underlying_coins: [],
	c_rates: [],
	bal_info: [],
	total: 0,
	l_info: [],
	totalShare: 0,
	showShares: false,

	slippage: 0,
	showSlippage: false,
	showNoBalance: false,
	showNoBalanceCoin: '',

	initializedContracts: false,

	default_account: '',

	error: false,

})

export let contract = state

export const getters = {
	currentPool: () => {
		return state.currentName
	},
	bal_info: () => state.contracts[state.currentName].bal_info,
	balTotal: () => state.contracts[state.currentName].total,
	l_info: () => state.contracts[state.currentName].l_info,
	totalShare: () => state.contracts[state.currentName].totalShare,
	totalShare: () => state.contracts[state.currentName].totalShare,
	fee: () => {
		return state.contracts[state.currentName].fee * 100
	},
	admin_fee: () => {
		return state.contracts[state.currentName].admin_fee * 100
	},
	initializedContracts: () => state.contracts[state.currentName].initializedContracts,
	contractAbis: () => allabis[state.currentName],
	N_COINS: () => state.contracts[state.currentName].N_COINS,
	oldBalance: () => state.contracts.compound.oldBalance,

	currencies: () => {
		return currencies[state.currentName]
	},
	slippage: () => state.slippage,
	showSlippage: () => state.showSlippage,
	error: () => state.error,
	showShares: () => state.showShares
}

export function newContract(contractName, contract, abi, address) {

}

export async function init(contractName = 'compound', refresh = false, multiInitState = true) {
	console.time('init')
	//contract = contracts.compound for example
	let contract = state.contracts[contractName]
	state.currentName = contractName
	if(contract.initializedContracts && !refresh) return Promise.resolve();
	try {
        let networkId = await web3.eth.net.getId();
        if(networkId != 1) {
            contract.error = 'Error: wrong network type. Please switch to mainnet';
        }
    }
    catch(err) {
        console.error(err);
        contract.error = 'There was an error connecting. Please refresh page';
    }

    let calls = [];
    if(contractName == 'compound') {
	    contract.old_swap = new web3.eth.Contract(allabis[contractName].old_swap_abi, old_swap_address);
	    contract.old_swap_token = new web3.eth.Contract(ERC20_abi, old_token_address);
    	calls.push(
    		[contract.old_swap_token._address, contract.old_swap_token.methods.balanceOf(state.default_account || '0x0000000000000000000000000000000000000000').encodeABI()
    	])
    }
	contract.deposit_zap = new web3.eth.Contract(allabis[contractName].deposit_abi, allabis[contractName].deposit_address)
    contract.swap = new web3.eth.Contract(allabis[contractName].swap_abi, allabis[contractName].swap_address);
    contract.swap_token = new web3.eth.Contract(ERC20_abi, allabis[contractName].token_address);
    contract.coins = []
    contract.underlying_coins = []
    if(window.location.href.includes('withdraw_old')) 
      calls.push(...(await common.update_fee_info('old', contractName, false)))
  	else 
      calls.push(...(await common.update_fee_info('new', contractName, false)));
    for (let i = 0; i < allabis[contractName].N_COINS; i++) {
    	calls.push([contract.swap._address, contract.swap.methods.coins(i).encodeABI()])
    	calls.push([contract.swap._address, contract.swap.methods.underlying_coins(i).encodeABI()])
    }
    if(!multiInitState) {
    	return calls
    }
    await common.multiInitState(calls, contractName, multiInitState)
  	contract.initializedContracts = true;
  	console.timeEnd('init')
  	state.allInitContracts.push(contractName)
  	return;
    let aggcalls = await state.multicall.methods.aggregate(calls).call()
    let decoded = aggcalls[1].map(hex => web3.eth.abi.decodeParameter('address', hex))
    chunkArr(decoded, 2).map((v, i) => {
    	var addr = v[0];
        let coin_abi = cERC20_abi
        if(['iearn', 'busd', 'susd'].includes(contractName)) coin_abi = yERC20_abi
        contract.coins.push(new web3.eth.Contract(coin_abi, addr));
        var underlying_addr = v[1];
        contract.underlying_coins.push(new web3.eth.Contract(ERC20_abi, underlying_addr));
    })
}

export const allState = Vue.observable({
	swap: {},
	underlying_coins: {},
})

export async function getAllUnderlying() {
	for([key, contract] of Object.entries(allabis)) {
		if(key == 'susd') continue;
		allState.swap[key] = new web3.eth.Contract(contract.swap_abi, contract.swap_address);
        allState.underlying_coins[key] = [];
		for(let i = 0; i < contract.N_COINS; i++) {
			var addr = await allState.swap[key].methods.coins(i).call();
	        var underlying_addr = await allState.swap[key].swap.methods.underlying_coins(i).call();
	        allState.underlying_coins[key][i] = new web3.eth.Contract(ERC20_abi, underlying_addr);
		}
	}
}

export async function changeContract(pool) {
	//re-init contract with different pool
	if(!(pool in allabis)) return;
	state.initializedContracts = false;
	state.currentContract = pool;
	state.currencies = currencies[pool]
	state.N_COINS = allabis[pool].N_COINS;
	state.coin_precisions = allabis[pool].coin_precisions;
	state.wrapped_precisions = allabis[pool].wrapped_precisions;
	state.swap_address = allabis[pool].swap_address;
	state.old_swap_address = allabis[pool].old_swap_address;
	state.token_address = allabis[pool].token_address;
	state.old_token_address = allabis[pool].old_token_address;
	state.migration_address = allabis[pool].migration_address;
	state.coins = new Array(allabis[pool].coins);
	state.underlying_coins = new Array(allabis[pool].underlying_coins);
	state.balances = new Array(allabis[pool].balances);
	state.wallet_balances = new Array(allabis[pool].wallet_balances);
	state.bal_info = []
	state.l_info = []
	state.total = 0
	state.totalShare = 0
	await web3Init();
}

export function setCurrencies(pool) {
	contract.currencies = currencies[pool]
}

export async function initusdt() {
	await init(state.contracts.usdt)
}