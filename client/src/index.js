import { ethers } from 'ethers'
import detectEthereumProvider from '@metamask/detect-provider'
import MetaMaskOnboarding from '@metamask/onboarding';
import $ from "jquery";
import axios from 'axios'
import './style.css';

axios.defaults.baseURL = 'http://localhost:3000';
axios.defaults.withCredentials = true

const contentSec = $('#content-section')
const signInBtn = $('#sign-in-button');
const connectToAccountBtn = $('#connect-to-account-button');
const logoutBtn = $('#logout-button');

function setBtnState(btn, show, state) {
    const spinner = btn.children('svg')
    if (show) {
        btn.removeClass('hidden')
    } else {
        btn.addClass('hidden');
    }

    if (state === 'loading') {
        btn.attr("disabled", true)
        spinner.addClass('block').removeClass('hidden')
    } else if (state === 'normal') {
        btn.removeAttr("disabled", true)
        spinner.addClass('hidden').removeClass('block')
    }
}
setBtnState(signInBtn, false, 'normal');
setBtnState(logoutBtn, false, 'normal');
setBtnState(connectToAccountBtn, true, 'normal');

let provider;
let ethereum;
let accounts = [];
let isAuthed = false;

async function main() {

    // Check if has installed provider(wallet extension)
    const walletProvider = await detectEthereumProvider();

    console.log(walletProvider);
    if (walletProvider) {
        ethereum = window.ethereum;
        console.log('Ethereum successfully detected!');
        if (walletProvider !== ethereum) {
            console.error('Do you have multiple wallets installed?');
        }
    } else {
        console.log('Please install Metamask!');
        const onboarding = new MetaMaskOnboarding();
        onboarding.startOnboarding({});
        return;
    }
    provider = new ethers.providers.Web3Provider(ethereum)

    const accounts = await ethereum.request({ method: 'eth_accounts' })
    console.log('accounts', accounts);
    accountsChangedHandler(accounts);


    try {
        const res = await axios.get('/auth/checkAuthenticated')
        isAuthed = true;
        const siggnedInAddress = res.data.address;
            console.log({siggnedInAddress});
            $('#signed-in-address').text(siggnedInAddress)
    } catch (err) {
        isAuthed = false
    }

    await authChangedHandler()

    connectToAccountBtn.on('click', async function () {
        setBtnState(connectToAccountBtn, true, 'loading');

        try {
            accounts = await ethereum.request({ method: 'eth_requestAccounts' })
            console.log({ accounts });
        } catch (err) {
            console.log(err.message);
        }
    })

    signInBtn.on('click', async function () {
        setBtnState(signInBtn, true, 'loading');

        const signer = provider.getSigner()
        console.log({ signer });

        const selectedAddress = ethers.utils.getAddress(ethereum.selectedAddress)

        let challangeMsg;
        try {
            const res = await axios.post('/auth/requestChallange', { address: selectedAddress })
            challangeMsg = res.data
        } catch (err) {
            console.error(err);
        }

        if (!challangeMsg) {
            console.error('Request a challange message from server!');
            return;
        }

        console.log('challange message', challangeMsg);

        let signature;
        try {
            signature = await signer.signMessage(challangeMsg)
            console.log(signature);
        } catch (err) {
            console.error(err);
            console.log(err.message);
        }


        try {
            const res = await axios.post(
                '/auth/login',
                { address: selectedAddress, signature: signature },
            )
            const siggnedInAddress = res.data.address;
            console.log({siggnedInAddress});
            $('#signed-in-address').text(siggnedInAddress)
        } catch (err) {
            console.error(err);
            console.log(err.message);
        }


        setBtnState(signInBtn, false, 'normal');
        setBtnState(logoutBtn, true)

        isAuthed = true;
        await authChangedHandler()
    })

    logoutBtn.on('click', async function() {
        try {
            axios.post('/auth/logout')
        } catch(err) {
            console.error(err);
        }
        isAuthed = false;
        authChangedHandler()
    })

    ethereum.on('accountsChanged', accountsChangedHandler)
}

async function authChangedHandler() {
    if (isAuthed) {
        setBtnState(signInBtn, false, 'normal');
        setBtnState(logoutBtn, true, 'normal');
        setBtnState(connectToAccountBtn, false, 'normal');

        contentSec.removeClass('hidden')
    } else {
        setBtnState(logoutBtn, false, 'normal')
        accountsChangedHandler(await provider.listAccounts());
        contentSec.addClass('hidden')
    }
}

function accountsChangedHandler(accounts) {
    console.log(
        { accountsChanged: accounts }
    );
    if (accounts.length === 0) {
        setBtnState(connectToAccountBtn, true, 'normal')
        setBtnState(signInBtn, false, 'normal')
    } else {
        setBtnState(connectToAccountBtn, false, 'normal')
        setBtnState(signInBtn, true, 'normal')
    }
}

main();

