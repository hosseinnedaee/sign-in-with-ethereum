import { ethers } from 'ethers'
import detectEthereumProvider from '@metamask/detect-provider'
import MetaMaskOnboarding from '@metamask/onboarding';
import $ from "jquery";
import axios from 'axios'
import './style.css';

const contentSec = $('#content-section')
const signInBtn = $('#sign-in-button');
const connectToAccountBtn = $('#connect-to-account-button');
const switchNetworkBtn = $('#switch-network-button');
const logoutBtn = $('#logout-button');
const onboardingMetamaskContainer = $('#onboarding')
const onboardingMetamaskBtn = onboardingMetamaskContainer.children('button');
const loadingSpinner = $('#loading');
const errorElm = $('#error-element')
const selectedAccountAddressElm = $('#signed-in-address')
const personaInfoBtn = $('#personal-info-button')

const statuses = {
    ONBOARD_METAMASK: 'ONBOARD_METAMASK',
    ONBOARDING_METAMASK: 'ONBOARDING_METAMASK',
    SWITCH_NETWORK: 'SWITCH_NETWORK',
    SWITCHING_NETWORK: 'SWITCHING_NETWORK',
    CONNECT_TO_WALLET: 'CONNECT_TO_WALLET',
    CONNECTING_TO_WALLET: 'CONNECTING_TO_WALLET',
    CONNECTED_TO_WALLET: 'CONNECTED_TO_WALLET',
    SIGN_IN: 'SIGN_IN',
    SIGNING_IN: 'SIGNING_IN',
    SIGNED_IN: 'SIGNED_IN',
}

const PolygonMumbaiChainId = {
    hex: '0x13881',
    dec: 80001
}
const PolygonNetworkParams = {
    chainId: PolygonMumbaiChainId.hex,
    chainName: 'Mumbai testnet',
    nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
    },
    rpcUrls: ['https://matic-mumbai.chainstacklabs.com'],
    blockExplorerUrls: ['https://mumbai.polygonscan.com/']
}

axios.defaults.baseURL = 'http://localhost:3000';
axios.defaults.withCredentials = true // to session cookie works

let provider;
let ethereum;

let states = {
    accounts: [],
    isAuthed: false,
    errorMsg: '',
    status: 'CONNECTING_TO_WALLET',
    selectedAddress: null
};

function setLoading(show) {
    if (show) {
        loadingSpinner.removeClass('hidden')
    } else {
        loadingSpinner.addClass('hidden')
    }
}
function setError(message) {
    if (message.length) {
        errorElm.removeClass('hidden').text(message)
    } else {
        errorElm.addClass('hidden').text('')
    }
}
function setBtnState(btn, show, state) {
    const spinner = btn.children('svg').first()
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
async function getEthereumProvider() {
    const ethereumProvider = await detectEthereumProvider();
    if (!ethereumProvider) {
        throw Error('Please install Metamask!')
    }

    if (ethereumProvider !== window.ethereum) {
        console.error('Do you have multiple wallets installed?');
    }

    console.log('Ethereum successfully detected!');

    return ethereumProvider;
}
async function authenticate(address) {
    setState({
        selectedAddress: address,
        isAuthed: true,
        status: statuses.SIGNED_IN
    })
}
async function unauthenticate() {
    deleteCookie('accessToken')
    deleteCookie('refreshToken')
    setState({
        selectedAddress: null,
        isAuthed: false,
    })
}
function setState(newStates) {
    states = { ...states, ...newStates }
    render();
}
async function accountsChangedHandler(accounts) {
    console.log({ accountsChanged: accounts });
    manageStatus({ accounts })
}
async function chainChangedHandler(chainId) {
    console.log('chainChanged', chainId)
    manageStatus({ chainId })
}
function deleteCookie(name, path, domain) {
    if (getCookie(name)) {
        document.cookie = name + "=" +
            ((path) ? ";path=" + path : "") +
            ((domain) ? ";domain=" + domain : "") +
            ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
    }
}
function getCookie(name) {
    let cookieStrings = document.cookie.split(';')
    let cookies = {}
    cookieStrings.forEach(string => {
        const [key, value] = string.split('=');
        cookies[key] = value
    });
    return cookies[name]
}
function render() {
    const { errorMsg, status, selectedAddress } = states;
    setBtnState(onboardingMetamaskBtn, false, 'normal')
    setBtnState(switchNetworkBtn, false, 'normal')
    setBtnState(connectToAccountBtn, false, 'normal')
    setBtnState(signInBtn, false, 'normal')
    setBtnState(logoutBtn, false, 'normal')

    contentSec.addClass('hidden')
    selectedAccountAddressElm.text('')

    if (!errorMsg.length) {
        errorElm.addClass('hidden').text('')
    } else {
        errorElm.removeClass('hidden').text(errorMsg)
    }

    switch (status) {
        case statuses.ONBOARD_METAMASK:
            setBtnState(connectToAccountBtn, false, 'normal')
            setBtnState(signInBtn, false, 'normal')
            onboardingMetamaskContainer.removeClass('hidden');
            break;
        case statuses.ONBOARDING_METAMASK:
            onboardingMetamaskContainer.children('button').addClass('hidden');
            onboardingMetamaskContainer.children('p').text('After Installation, Refresh the page.')
            break;
        case statuses.ONBOARDING_METAMASK:
            onboardingMetamaskContainer.children('button').addClass('hidden');
            onboardingMetamaskContainer.children('p').text('After Installation, Refresh the page.')
            break;
        case statuses.SWITCH_NETWORK:
            setBtnState(switchNetworkBtn, true, 'normal')
            break;
        case statuses.SWITCHING_NETWORK:
            setBtnState(switchNetworkBtn, true, 'loading')
            break;
        case statuses.CONNECT_TO_WALLET:
            setBtnState(connectToAccountBtn, true, 'normal')
            break;
        case statuses.CONNECTING_TO_WALLET:
            setBtnState(connectToAccountBtn, true, 'loading')
            break;
        case statuses.SIGN_IN:
            setBtnState(signInBtn, true, 'normal')
            break;
        case statuses.SIGNING_IN:
            setBtnState(signInBtn, true, 'loading')
            break;
        case statuses.SIGNED_IN:
            contentSec.removeClass('hidden')
            selectedAccountAddressElm.text(selectedAddress)
            setBtnState(logoutBtn, true, 'normal')
            break;
        default:
            break;
    }
}
async function manageStatus(params) {
    const accounts = params?.accounts || await provider.listAccounts();
    const chainId = params?.chainId || (await provider.getNetwork())?.chainId

    if (!(chainId === PolygonMumbaiChainId.hex || chainId === PolygonMumbaiChainId.dec)) {
        unauthenticate()
        setState({ status: statuses.SWITCH_NETWORK })
        return;
    }

    if (!accounts.length) {
        setState({ status: statuses.CONNECT_TO_WALLET })
        unauthenticate()
        return;
    }

    if(!states.isAuthed) {
        setState({ status: statuses.SIGN_IN })
        unauthenticate();
        return;
    }
    
    authenticate(accounts[0])

}

connectToAccountBtn.on('click', async function () {
    setBtnState(connectToAccountBtn, true, 'loading');
    setState({ errorElm: '' })
    setState({ status: 'CONNECTING_TO_WALLET' })

    try {
        await ethereum.request({ method: 'eth_requestAccounts' })
    } catch (err) {
        console.log(err.message);
        setState({ errorMsg: err.message })
    }
    setBtnState(connectToAccountBtn, true, 'normal');
})
switchNetworkBtn.on('click', async function () {
    setState({ status: statuses.SWITCHING_NETWORK })
    try {
        await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: PolygonMumbaiChainId.hex }] })
    } catch (err) {
        console.error({ switchnetwork: err });
        if (err.code === 4902) { // Unrecognized chain ID 
            try {
                await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [ PolygonNetworkParams ]
                })
                await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: PolygonMumbaiChainId.hex }] })
            } catch (error) {
                setError(error.message)
            }
        }
    }
})
signInBtn.on('click', async function () {
    setState({ status: statuses.SIGNING_IN })
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
            '/auth/sign_in',
            { address: selectedAddress, signature: signature },
        )
        const siggnedInAddress = res.data.address;
        console.log({ siggnedInAddress });
        await authenticate(siggnedInAddress)

    } catch (err) {
        console.error(err);
        console.log(err.message);
        setState({
            status: statuses.SIGN_IN
        })
    }
})
logoutBtn.on('click', async function () {
    try {
        await axios.post('/auth/sign_out')
    } catch (err) {
        console.error(err);
    }

    unauthenticate();
    manageStatus()
})
personaInfoBtn.on('click', async function () {
    try {
        const res = await axios.get('/personal_information')
        console.log('Personal Information: ', res.data.message)
    } catch(e) {
        console.error(e.message);
        unauthenticate();
        manageStatus()
    }
})
onboardingMetamaskBtn.on('click', async function () {
    const onboarding = new MetaMaskOnboarding();
    onboarding.startOnboarding({});
    setState({ status: statuses.ONBOARDING_METAMASK })
})

async function main() {

    setLoading(true)
    try {
        ethereum = await getEthereumProvider();

        provider = new ethers.providers.Web3Provider(ethereum)

        ethereum.on('accountsChanged', accountsChangedHandler)
        ethereum.on('chainChanged', chainChangedHandler)
    } catch (err) {
        console.log(err.message);
        setState({ status: statuses.ONBOARD_METAMASK })
    }

    try {
        const res = await axios.get('/personal_information')
        const {address, message} = res.data;
        setState({isAuthed: true})
    } catch(e) {
        console.error(e.message);
        unauthenticate();
    }

    setLoading(false)

    manageStatus()
}
main();

