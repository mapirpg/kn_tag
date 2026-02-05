import * as elliptic from 'elliptic';
import * as crypto from 'crypto';

const ec224 = new elliptic.ec('p224');

export function generateTagKeys() {
  const keyPair = ec224.genKeyPair();

  const privateKey = Buffer.from(keyPair.getPrivate().toArray());
  const publicKey = Buffer.from(keyPair.getPublic().encode('array', false));

  // Generate hashed public key for Apple's API
  const hashedPublicKey = crypto
    .createHash('sha256')
    .update(publicKey)
    .digest();

  return {
    privateKey: privateKey.toString('base64'),
    publicKey: publicKey.toString('base64'),
    hashedPublicKey: hashedPublicKey.toString('base64'),
  };
}
