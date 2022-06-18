import express from 'express'
import bodyParser from 'body-parser'
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'
import cors from 'cors'
import { ethers } from 'ethers'
import * as db from './db/models/index.cjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser';
import { ErrorTypes, SiweMessage } from 'siwe'

export const SecretOrPrivateKey = 'a-secret-private-key'
export const SecretOrPublicKey = 'a-secret-public-key'
export const AccessTokenExpire = '30m' // 30 minutes
export const RefreshTokenExpire = '1d' // one day
// export const AccessTokenExpire = '10s' // 30 minutes
// export const RefreshTokenExpire = '20s' // one day
const CookieAccessTokenMaxAge = 1800000 // 30 minutes
const CookieRefreshTokenMaxAge = 86400000 // 1 day

const { Challange } = db.default

const MaticChainId = '80001'

const app = express()
const port = 3000

app.use(cors({
    origin: 'http://localhost:8080',
    credentials: true
}))
app.use(bodyParser.json());
app.use(cookieParser())

function checkAuth(req, res, next) {
    console.log(req.cookies);
    const { accessToken, refreshToken } = req.cookies;

    if (!accessToken) {
        return res.status(401).send('please authenticate - no access token');
    }

    let userAddress;
    try {
        const decoded = jwt.verify(accessToken, SecretOrPrivateKey, { complete: true })
        userAddress = decoded.payload.id
        console.log('1', { decoded, userAddress });
    } catch (err) {
        console.log('checkAuth err', err);
        res.clearCookie("accessToken");

        if (!refreshToken) {
            return res
                .clearCookie("refreshToken")
                .status(401).send('please authenticate - no refresh token');
        }
        try {
            const decoded = jwt.verify(refreshToken, SecretOrPrivateKey, { complete: true })
            userAddress = decoded.payload.id
        } catch (err) {
            return res
                .clearCookie("refreshToken")
                .status(401)
                .send('please authenticate again - refresh token is invalid or expired')
        }
        console.log('2', { userAddress });
        const { accessToken } = generateJWTTokens(userAddress, false)

        res.cookie("accessToken", accessToken, { httpOnly: false, secure: false, sameSite: true, maxAge: CookieAccessTokenMaxAge })
    }

    req.address = userAddress
    req.isAuth = true
    next();
}
function createSiweMessage(address, statement, domain, origin) {
    const siweMessage = new SiweMessage({
        domain: domain,
        address: address,
        statement: statement,
        uri: origin,
        version: '1',
        chainId: MaticChainId,
    })
    return siweMessage.prepareMessage();
}
function generateJWTTokens(address, withRefreshToken = false) {
    let result = {}

    result.accessToken = jwt.sign(
        { id: address, role: "normal" },
        SecretOrPrivateKey,
        { algorithm: 'HS256', expiresIn: AccessTokenExpire, noTimestamp: false, keyid: '1' }
    )

    if (withRefreshToken) {
        result.refreshToken = jwt.sign(
            { id: address, role: "refresh" },
            SecretOrPrivateKey,
            { algorithm: 'HS256', expiresIn: RefreshTokenExpire, noTimestamp: false, keyid: '1' }
        )
    }

    console.log('generated jwt tokens:', result);

    return result
}

app.get('/', checkAuth, (req, res) => {
    res.send(`hello ${req.address} !!`);
})

app.post('/auth/requestChallange', async (req, res) => {
    const address = req.body.address

    if (!ethers.utils.isAddress(address)) {
        return res.status(422).send('Address is not valid!');
    }
    
    const issuedAt = new Date();
    let expiresIn = new Date()
    expiresIn.setSeconds(expiresIn.getSeconds() + 300) // 5 mins

    const challangeText = createSiweMessage(address, 'Sign in with ethereum to app', req.get('host'), req.get('origin'))

    let challange = await Challange.findOne({ where: { address: address } })

    if (!challange) {
        challange = await Challange.create({
            address,
            challangeText,
            issuedAt,
            expiresIn
        })
    } else {
        challange = await challange.update({
            challangeText,
            issuedAt,
            expiresIn
        })
    }

    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(challangeText).end()
})

app.post('/auth/sign_in', async (req, res) => {
    let challange;
    let address;
    try {
        address = req.body.address;
        const signature = req.body.signature;
        if (!address || !signature) {
            return res.status(422).json({ message: 'address and signature are required.' })
        }

        challange = await Challange.findOne({ where: { address } })
        if (challange === null) {
            return res.status(422).json({ message: 'Challange does not exists!' })
        }

        if ((new Date()).getTime() > challange.expiresIn.getTime()) {
            await Challange.destroy({ where: { address } })
            return res.status(440).json({ message: 'Challange expired!' })
        }

        const message = new SiweMessage(challange.challangeText)
        await message.validate(signature)

        await Challange.destroy({ where: { address: address } })

        const { accessToken, refreshToken } = generateJWTTokens(address, true)

        return res
            .cookie("accessToken", accessToken, { httpOnly: false, secure: false, sameSite: true, maxAge: CookieAccessTokenMaxAge })
            .cookie("refreshToken", refreshToken, { httpOnly: false, secure: false, sameSite: true, maxAge: CookieRefreshTokenMaxAge })
            .json({
                address,
                accessToken,
                refreshToken
            })
            .status(200)

    } catch (e) {
        console.error(e);
        switch (e) {
            case ErrorTypes.EXPIRED_MESSAGE:
                challange && await Challange.destroy({ where: { address } })
                return res.status(440).json({ mesage: e.message })
            case ErrorTypes.INVALID_SIGNATURE:
                challange && await Challange.destroy({ where: { address } })
                return res.status(422).json({ mesage: e.message })
            default:
                return res.status(500).json({ message: e.message })
        }
    }
})

app.get('/personal_information', checkAuth, function (req, res) {
    console.log('User is authenticated!');
    res
        .status(200)
        .json({
            message: `You are authenticated and your address is: ${req.address}`,
            address: req.address
        })
})

app.post('/auth/sign_out', checkAuth, async (req, res) => {
    return res
        .clearCookie('accessToken').clearCookie('refreshToken')
        .send('logged-out!')
})

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})