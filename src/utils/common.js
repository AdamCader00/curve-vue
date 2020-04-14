import Vue from "vue";
import BigNumber from 'bignumber.js'
import { contract as currentContract, infura_url, newContract } from '../contract.js'
import { chunkArr } from './helpers'
import allabis, { multicall_address, multicall_abi, ERC20_abi, cERC20_abi, yERC20_abi } from '../allabis'
import Web3 from "web3";

var cBN = (val) => new BigNumber(val);

export function approve(contract, amount, account, toContract) {
    if(!toContract) toContract = allabis[currentContract.currentName].swap_address
    console.log(toContract, "TO CONTRACT")
    return new Promise(resolve => {
                contract.methods.approve(toContract, cBN(amount).toFixed(0,1))
                .send({from: account, gas: 100000})
                .once('transactionHash', function(hash) {resolve(true);});
            });
}


export function approve_to_migrate(amount, account) {
    return new Promise(resolve => {
                currentContract.currentContract.old_swap_token.methods.approve(currentContract.currentContract.migration_address, amount)
                .send({from: account, gas: 100000})
                .once('transactionHash', function(hash) {resolve(true);});
            });
}

export async function ensure_allowance_zap_out(amount) {
    var default_account = currentContract.default_account
    let name = currentContract.currentName
    let fromContract = currentContract.currentContract.swap_token;
    let toContract = allabis[name].deposit_address
    let allowance = await currentContract.currentContract.swap_token.methods.allowance(default_account, toContract).call()

    if(allowance > 0) await approve(fromContract, 0, default_account, toContract)
    await approve(fromContract, amount, default_account, toContract)
}

export async function ensure_allowance(amounts, plain = false) {
    var default_account = currentContract.default_account
    let name = currentContract.currentName
    var allowances = new Array(allabis[name].N_COINS);
    let coins = currentContract.currentContract.coins;
    let swap = allabis[name].swap_address;
    if(plain) {
        coins = currentContract.currentContract.underlying_coins;
        swap = allabis[name].deposit_address;
    }
    let fromContract = coins
    let calls = []
    for (let i=0; i < allabis[name].N_COINS; i++)
        calls.push([coins[i]._address, coins[i].methods.allowance(default_account, swap).encodeABI()])
    let aggcalls = await currentContract.multicall.methods.aggregate(calls).call();
    allowances = aggcalls[1].map(hex => web3.eth.abi.decodeParameter('uint256', hex));
    if (amounts) {
        // Non-infinite
        for (let i=0; i < allabis[name].N_COINS; i++) {
            if (cBN(allowances[i]).isLessThan(amounts[i])) {
                if (allowances[i] > 0)
                    await approve(coins[i], 0, default_account, swap);
                await approve(coins[i], amounts[i], default_account, swap);
            }
        }
    }
    else {
        // Infinite
        for (let i=0; i < allabis[name].N_COINS; i++) {
            if (cBN(allowances[i]).isLessThan(currentContract.max_allowance.div(cBN(2)))) {
                if (allowances[i] > 0)
                    await approve(coins[i], 0, default_account, swap);
                await approve(coins[i], max_allowance, default_account, swap);
            }
        }
    }
}

export async function ensure_underlying_allowance(i, _amount, underlying_coins = [], toContract, wrapped = false, contractName) {
    if(!contractName) contractName = currentContract.currentName
    let contract = currentContract.contracts[contractName]
    if(!underlying_coins.length) underlying_coins = contract.underlying_coins;
    let coins = underlying_coins
    if(wrapped) coins = contract.coins
    var default_account = currentContract.default_account
    var amount = cBN(_amount);
    var current_allowance = cBN(await coins[i].methods.allowance(default_account, contract.swap._address).call());
    if (current_allowance.isEqualTo(amount))
        return false;
    if ((cBN(_amount).isEqualTo(currentContract.max_allowance)) & (current_allowance.isGreaterThan(currentContract.max_allowance.div(cBN(2)))))
        return false;  // It does get spent slowly, but that's ok

    if ((current_allowance.isGreaterThan(cBN(0))) & (current_allowance.isLessThan(amount)))
        await approve(coins[i], 0, default_account, toContract);
    return await approve(coins[i], cBN(amount).toFixed(0,1), default_account, toContract);
}

// XXX not needed anymore
// Keeping for old withdraw, to be removed whenever the chance is
export async function ensure_token_allowance() {
    var default_account = currentContract.default_account
    if (parseInt(await currentContract.swap_token.methods.allowance(default_account, currentContract.swap_address).call()) == 0)
        return new Promise(resolve => {
            currentContract.swap_token.methods.approve(currentContract.swap_address, cBN(currentContract.max_allowance).toFixed(0))
            .send({from: default_account})
            .once('transactionHash', function(hash) {resolve(true);});
        })
    else
        return false;
}

export function init_menu() {
    $("div.top-menu-bar a").toArray().forEach(function(el) {
        if (el.href == window.location.href)
            el.classList.add('selected')
    })
    $('.poolsdropdown .dropdown a').toArray().forEach(function(el) {
        if(el.href.slice(0,-1) == window.location.origin)
            el.classList.add('selected')
    })
}


export function update_rates(version = 'new', contractName) {
    let contract = currentContract.contracts[contractName]
    let calls = [];
    for (let i = 0; i < allabis[contractName].N_COINS; i++) {
        let address = allabis[contractName].coins[i]
        /*
        rate: uint256 = cERC20(self.coins[i]).exchangeRateStored()
        supply_rate: uint256 = cERC20(self.coins[i]).supplyRatePerBlock()
        old_block: uint256 = cERC20(self.coins[i]).accrualBlockNumber()
        rate += rate * supply_rate * (block.number - old_block) / 10 ** 18
        */
        //for usdt pool
        if(allabis[contractName].tethered && allabis[contractName].tethered[i] &&
            allabis[contractName].use_lending && !allabis[contractName].use_lending[i]) {
            Vue.set(contract.c_rates, i, 1 / allabis[contractName].coin_precisions[i]);
        }
        else if(['iearn', 'busd'].includes(contractName)) {
            //getPricePerFullShare
            calls.push([address, '0x77c7b8fc'])
        }
        else {
            calls.push(
                //exchangeRateStored
                [address, '0x182df0f5'],
                //supplyRatePerBlock
                [address, '0xae9d70b0'],
                //accrualBlockNumber
                [address, '0x6c540baf'],
            )
        }
    }
    return calls;
}

export async function update_fee_info(version = 'new', contractName = 'compound', update = true) {
    console.time('updatefeeinfo')
    let contract = currentContract.contracts[contractName]
    let web3 = currentContract.web3 || new Web3(infura_url)
    var swap_abi_stats = allabis[contractName].swap_abi;
    var swap_address_stats = allabis[contractName].swap_address;
    var swap_token_stats = allabis[contractName].swap_token
    var swap_token_address = allabis[contractName].token_address
    var swap_stats = contract.swap;
    var swap_token_stats = contract.swap_token;
    if(version == 'old') {
        swap_abi_stats = allabis[contractName].old_swap_abi;
        swap_address_stats = allabis[contractName].old_swap_address;
        swap_stats = contract.old_swap;
        swap_token_stats = contract.old_swap_token;
        swap_token_address = allabis[contractName].token_address
    }

    var default_account = currentContract.default_account || '0x0000000000000000000000000000000000000000';
    let calls = [   
                    //.fee()
                    [swap_address_stats, swap_stats.methods.fee().encodeABI()],
                    //.admin_fee()
                    [swap_address_stats, swap_stats.methods.admin_fee().encodeABI()],
                    //balanceOf(default_account)
                    [swap_token_address, swap_token_stats.methods.balanceOf(default_account).encodeABI()],
                    //token_supply()
                    [swap_token_address, swap_token_stats.methods.totalSupply().encodeABI()],
                    ]
    let rates_calls = update_rates(version, contractName);

    let swap = new web3.eth.Contract(swap_abi_stats, swap_address_stats);
    for (let i = 0; i < allabis[contractName].N_COINS; i++) {
        //swap.methods.balances(i)
        calls.push([swap_address_stats, swap.methods.balances(i).encodeABI()])
    }
    calls.push(...rates_calls)
    if(update)
        await multiInitState(calls, contractName)
    return calls
    
    console.timeEnd('updatefeeinfo')
}

function checkTethered(contractName, i) {
    return allabis[contractName].tethered && allabis[contractName].tethered[i] &&
        allabis[contractName].use_lending && !allabis[contractName].use_lending[i];
}

export async function multiInitState(calls, contractName, initContracts = false) {
    console.log(contractName, "CONTRACT NAME")
    let contract = currentContract.contracts[contractName]
    let web3 = currentContract.web3 || new Web3(infura_url)
    let multicall = new web3.eth.Contract(multicall_abi, multicall_address)
    var default_account = currentContract.default_account;
    let aggcalls = await multicall.methods.aggregate(calls).call()
    var block = +aggcalls[0]
    let decoded = aggcalls[1].map((hex, i) => 
        (initContracts && contractName == 'compound' && i == 0 || i >= aggcalls[1].length-allabis[contractName].N_COINS*2) ? 
            web3.eth.abi.decodeParameter('address', hex) : web3.eth.abi.decodeParameter('uint256', hex)
    )
    if(initContracts && contractName == 'compound') {
        contract.oldBalance = decoded[0];
        decoded = decoded.slice(1);
    }
    contract.fee = decoded[0] / 1e10;
    contract.admin_fee = decoded[1] / 1e10;
    var token_balance = decoded[2]
    var token_supply = decoded[3]
    let ratesDecoded = decoded.slice(4+allabis[contractName].N_COINS)
    if(initContracts) {
        let contractsDecoded = decoded.slice(-allabis[contractName].N_COINS*2)
        chunkArr(contractsDecoded, 2).map((v, i) => {
            var addr = v[0];
            let coin_abi = cERC20_abi
            if(['iearn', 'busd'].includes(contractName)) coin_abi = yERC20_abi
            contract.coins.push(new web3.eth.Contract(coin_abi, addr));
            var underlying_addr = v[1];
            contract.underlying_coins.push(new web3.eth.Contract(ERC20_abi, underlying_addr));
        })
        ratesDecoded = decoded.slice(4+allabis[contractName].N_COINS, decoded.length-allabis[contractName].N_COINS*2)
    }


    if(['iearn', 'busd'].includes(contractName)) {
        ratesDecoded.map((v, i) => {
            if(checkTethered(contractName, i)) {
                Vue.set(contract.c_rates, i, 1 / allabis[contractName].coin_precisions[i]);
            }
            else {
                let rate = v / 1e18 / allabis[contractName].coin_precisions[i]
                Vue.set(contract.c_rates, i, rate)
            }
        })
    }
    else {
        chunkArr(ratesDecoded ,3).map((v, i) => {
            if(checkTethered(contractName, i)) {
                Vue.set(contract.c_rates, i, 1 / allabis[contractName].coin_precisions[i]);
            }
            else {            
                let rate = +v[0] / 1e18 / allabis[contractName].coin_precisions[i]
                let supply_rate = +v[1]
                let old_block = +v[2]
                Vue.set(contract.c_rates, i, rate * (1 + supply_rate * (block - old_block) / 1e18))
            }
        })
    }

    let balances = []
    contract.total = 0;

    let balancesDecoded = decoded.slice(4, 4+allabis[contractName].N_COINS)
    balancesDecoded.forEach((balance, i) => {
        Vue.set(contract.balances, i, +balance)
        balances[i] = +balance;
        Vue.set(contract.bal_info, i, balances[i] * contract.c_rates[i]);
        contract.total += balances[i] * contract.c_rates[i];
    })

    if (default_account) {
        if (token_balance > 0) {
            contract.totalShare = 0;
            for (let i=0; i < allabis[contractName].N_COINS; i++) {
                var val = balances[i] * contract.c_rates[i] * token_balance / token_supply;
                contract.totalShare += val;
                Vue.set(contract.l_info, i, val)
            }
            contract.showShares = true;
        }
        else {
            contract.totalShare = 0;
            contract.showShares = false;
            //no need to set other values as v-show check is done based on totalShare
        }
    }
}

export async function handle_migrate_new(page) {
    var default_account = currentContract.default_account
    let migration = new web3.eth.Contract(allabis.compound.migration_abi, currentContract.migration_address);
    let old_balance = await currentContract.old_swap_token.methods.balanceOf(default_account).call();
    var allowance = parseInt(await currentContract.old_swap_token.methods.allowance(default_account, currentContract.migration_address).call());
    if(allowance < old_balance) {
        if (allowance > 0)
            await approve_to_migrate(0, default_account);
        await approve_to_migrate(old_balance, default_account);
    }
    await migration.methods.migrate().send({
        from: default_account,
        gas: 1500000
    });

    await update_balances();
    update_fee_info(page);
}

export async function calc_slippage(values, deposit, zap_values, to_currency) {
    let contract = currentContract.contracts[currentContract.currentName]
    let name = currentContract.currentName
    console.log(contract.swap.methods, "METHODS")
    //var real_values = [...$("[id^=currency_]")].map((x,i) => +($(x).val()));
    let slippage = 0;
    var real_values = Array(allabis[name].N_COINS).fill(0)
    let calls = [
        [contract.swap._address ,contract.swap.methods.get_virtual_price().encodeABI()],
    ]
    if(to_currency !== undefined) {
        let precision = allabis[name].coin_precisions[to_currency]
        real_values[to_currency] = zap_values[to_currency].div(precision)
        zap_values[to_currency] = zap_values[to_currency].times(1e18/precision)
        var Sr = zap_values[to_currency]
        zap_values[to_currency] = zap_values[to_currency].div(1e18).div(contract.c_rates[to_currency]).toFixed(0);
        calls.push([contract.swap._address, contract.swap.methods.calc_token_amount(zap_values, to_currency).encodeABI()])

    }
    else {
        real_values = values.map(v=>+v);
        var Sr = real_values.reduce((a,b) => a+b, 0);

        var values = real_values.map((x,i) => cBN(Math.floor(x / contract.c_rates[i]).toString()).toFixed(0,1));
        calls.push([contract.swap._address, contract.swap.methods.calc_token_amount(values, deposit).encodeABI()])
    }
    calls.push(...[...Array(allabis[name].N_COINS).keys()].map(i => [contract.swap._address, contract.swap.methods.balances(i).encodeABI()]))
    let aggcalls = await currentContract.multicall.methods.aggregate(calls).call();
    let decoded = aggcalls[1].map(hex => web3.eth.abi.decodeParameter('uint256', hex))
    let [virtual_price, token_amount, ...balances] = decoded
    let Sv = +virtual_price * (+token_amount) / 1e36;
    for(let i = 0; i < allabis[name].N_COINS; i++) {
        let coin_balance = +balances[i] * contract.c_rates[i];
        if(!deposit) {
            if(coin_balance < real_values[i]) {
                currentContract.showNoBalance = true;
                currentContract.noBalanceCoin = i;
            }
            else
                currentContract.showNoBalance = false;
        }
    }
    if (deposit)
        slippage = Sv / Sr
    else if(to_currency === undefined) {
        slippage = Sr / Sv;
    }
    else
        slippage = Sr / (Sv * 1e18)
    slippage = slippage - 1;
    slippage = slippage || 0
    console.log(slippage)
    currentContract.slippage = slippage;
    currentContract.showSlippage = true;
}