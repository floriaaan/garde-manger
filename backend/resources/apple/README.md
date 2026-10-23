# Apple public trust roots

Downloaded from Apple's PKI site on 2026-10-21. Public certificates only;
these files contain no signing keys. Both expire on 2039-04-30.

- [Apple Root CA G2](https://www.apple.com/certificateauthority/AppleRootCA-G2.cer)
  SHA-256: `c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050`
- [Apple Root CA G3](https://www.apple.com/certificateauthority/AppleRootCA-G3.cer)
  SHA-256: `63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179`

The App Store Server Library verifies certificate chains against these roots
with online revocation checks. `backend/adonisrc.ts` copies them to builds.
