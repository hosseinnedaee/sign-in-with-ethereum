import express from 'express'
import bodyParser from 'body-parser'
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'
import cors from 'cors'
import { ethers } from 'ethers'
import * as db from './db/models/index.cjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser';

export const SecretOrPrivateKey = 'a-secret-private-key'
export const SecretOrPublicKey = 'a-secret-public-key'
export const AccessTokenExpire = '30m' // 30 minutes
export const RefreshTokenExpire = '1d' // one day
// export const AccessTokenExpire = '10s' // 30 minutes
// export const RefreshTokenExpire = '20s' // one day

const { Challange } = db.default

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
        const accessToken = jwt.sign(
            { id: userAddress, role: "normal" },
            SecretOrPrivateKey,
            { algorithm: 'HS256', expiresIn: AccessTokenExpire, noTimestamp: false, keyid: '1' }
        )
        res.cookie("accessToken", accessToken, { httpOnly: true })
        // return res.status(401).send('please authenticate - accessToken is invalid or expired')
    }

    req.address = userAddress
    req.isAuth = true
    next();
}

app.get('/', checkAuth, (req, res) => {
    res.send(`hello ${req.address} !!`);
})
app.get('/auth/checkAuthenticated', checkAuth, (req, res) => {
    return res.status(200).json({address: req.address});
})

app.post('/auth/requestChallange', async (req, res) => {
    const address = req.body.address

    if (!ethers.utils.isAddress(address)) {
        return res.status(422).send('Address is not valid!');
    }

    const nonce = uuidv4();
    const issuedAt = new Date();
    let expiresIn = new Date()
    expiresIn.setSeconds(expiresIn.getSeconds() + 300) // 5 mins

    const challangeCode = crypto.createHash('sha256').update(address + nonce + issuedAt.getTime()).digest('hex');

    let challange = await Challange.findOne({ where: { address: address } })

    if (!challange) {
        challange = await Challange.create({
            address: address,
            challangeCode: challangeCode,
            issuedAt: issuedAt,
            expiresIn: expiresIn
        })
    } else {
        challange = await challange.update({
            challangeCode: challangeCode,
            issuedAt: issuedAt,
            expiresIn: expiresIn
        })
    }

    const challangeMessage = `I want to authenticate with lens and generate a JWT token at timestamp - ${issuedAt.getTime()}. Auth request id - ${challangeCode}`

    return res.send(challangeMessage)
})

app.post('/auth/login', async (req, res) => {
    const address = req.body.address;
    const signature = req.body.signature;

    const challange = await Challange.findOne({ where: { address: address } })
    if (challange === null) {
        return res.status(401).send('Challange does not exists!')
    }
    if ((new Date()).getTime() > challange.expiresIn.getTime()) {
        await Challange.destroy({ where: { address: address } })
        return res.status(401).send('Challange expired!')
    }

    const message = `I want to authenticate with lens and generate a JWT token at timestamp - ${challange.issuedAt.getTime()}. Auth request id - ${challange.challangeCode}`

    let signerAddress;
    try {
        signerAddress = ethers.utils.verifyMessage(message, signature)
    } catch (err) {
        return res.status(401).send('Signature is not valid!')
    }
    if (signerAddress !== address) {
        return res.status(401).send('Signature is not valid!')
    }

    await Challange.destroy({ where: { address: address } })

    const accessToken = jwt.sign(
        { id: address, role: "normal" },
        SecretOrPrivateKey,
        { algorithm: 'HS256', expiresIn: AccessTokenExpire, noTimestamp: false, keyid: '1' }
    )
    const refreshToken = jwt.sign(
        { id: address, role: "refresh" },
        SecretOrPrivateKey,
        { algorithm: 'HS256', expiresIn: RefreshTokenExpire, noTimestamp: false, keyid: '1' }
    )

    console.log({
        accessToken, refreshToken
    });

    return res
        .cookie("accessToken", accessToken, { httpOnly: true })
        .cookie("refreshToken", refreshToken, { httpOnly: true })
        .json({
            address: address,
            accessToken,
            refreshToken
        })
        .status(200)
})

app.post('/auth/logout', checkAuth, async (req, res) => {
    return res
        .clearCookie('accessToken').clearCookie('refreshToken')
        .send('logged-out!')
})

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})