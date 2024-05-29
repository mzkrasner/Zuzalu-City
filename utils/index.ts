//import type { CeramicApi } from "@ceramicnetwork/common";
import type { ComposeClient } from '@composedb/client';
import { Cacao, SiweMessage } from '@didtools/cacao';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import { getResolver } from 'key-did-resolver';
import { DID } from 'dids';
import { Wallet, randomBytes, BrowserProvider, getDefaultProvider } from 'ethers';
import { DIDSession, createDIDCacao, createDIDKey } from 'did-session';
import * as u8a from 'uint8arrays';
import { EthereumWebAuth, getAccountId } from '@didtools/pkh-ethereum';
import { AccountId } from 'caip';
import { SolanaWebAuth, getAccountIdByNetwork } from '@didtools/pkh-solana';
import { StreamID } from '@ceramicnetwork/streamid';
//import { ModelInstanceDocument } from '@composedb/types';
//import { makeCeramicDaemon } from "@ceramicnetwork/cli/lib/__tests__/make-ceramic-daemon";
import { CeramicClient } from '@ceramicnetwork/http-client';

const DID_SEED_KEY = 'ceramic:did_seed';

export const authenticateEthPKH = async (
  ceramic: CeramicClient,
  compose: ComposeClient,
) => {
  if (window.ethereum === null || window.ethereum === undefined) {
    throw new Error('No injected Ethereum provider found.');
  }

  // We enable the ethereum provider to get the user's addresses.
  const ethProvider =  new BrowserProvider( window.ethereum );
  console.log('found provider', ethProvider);
  // request ethereum accounts.
  const addresses = await ethProvider.listAccounts();
  console.log('found addresses', addresses[0].address);
  const address = addresses[0].address;
  let seed_array: Uint8Array;

    // for production you will want a better place than localStorage for your sessions.
    console.log("Generating seed...");
    let seed = crypto.getRandomValues(new Uint8Array(32));
    let seed_json = JSON.stringify(seed, (key, value) => {
      if (value instanceof Uint8Array) {
        return Array.from(value);
      }
      return value;
    });
    localStorage.setItem(DID_SEED_KEY, seed_json);
    seed_array = seed;
    console.log("Generated new seed: " + seed);
  
  console.log('keySeed', seed_array);
  const buf = Buffer.from(seed_array);
  const provider = new Ed25519Provider(buf);
  const didKey = new DID({ provider, resolver: getResolver() });
  await didKey.authenticate();
  console.log('didKey', didKey);
  const now = new Date();
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  console.log(didKey.id, 'didKey.id')

  const siweMessage = new SiweMessage({
    domain: window.location.origin,
    address,
    statement: 'Give this application access to some of your data on Ceramic',
    uri: didKey.id,
    version: '1',
    chainId: '1',
    nonce: u8a.toString(randomBytes(8), 'base64url'),
    issuedAt: now.toISOString(),
    expirationTime: oneMonthLater.toISOString(),
    resources: ['ceramic://*'],
  });

  const signer = await ethProvider.getSigner()
  const signature = await signer.signMessage(siweMessage.signMessage());
  siweMessage.signature = signature;
  const cacao = Cacao.fromSiweMessage(siweMessage);
  const did = await createDIDCacao(didKey, cacao);
  const newSession = new DIDSession({ cacao, keySeed: seed_array, did });
  // const authBearer = newSession.serialize();
  const session = newSession;

  // Set our Ceramic DID to be our session DID.
  compose.setDID(session.did);
  ceramic.did = session.did;
  localStorage.setItem('display did', session.did.toString());
  console.log(session.did, 'session did');
  console.log(compose.did, 'user did');
  return;
};
