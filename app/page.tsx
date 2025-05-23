"use client";

import { useEffect, useState } from "react";
import { tKey, ethereumPrivateKeyProvider } from "./tkey";
import { ShareSerializationModule } from "@tkey/share-serialization";
import { SfaServiceProvider } from "@tkey/service-provider-sfa";
import { WebStorageModule } from "@tkey/web-storage";
import { Web3 } from "web3";

// Firebase libraries for custom authentication
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  UserCredential,
} from "firebase/auth";

import { IProvider } from "@web3auth/base";

const verifier = "w3a-firebase-demo";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0nd9YsPLu-tpdCrsXn8wgsWVAiYEpQ_E",
  authDomain: "web3auth-oauth-logins.firebaseapp.com",
  projectId: "web3auth-oauth-logins",
  storageBucket: "web3auth-oauth-logins.appspot.com",
  messagingSenderId: "461819774167",
  appId: "1:461819774167:web:e74addfb6cc88f3b5b9c92",
};

function App() {
  const [tKeyInitialised, setTKeyInitialised] = useState(false);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>({});
  const [recoveryShare, setRecoveryShare] = useState<string>("");
  const [mnemonicShare, setMnemonicShare] = useState<string>("");
  const [serviceProviderInitialized, setServiceProviderInitialized] =
    useState(false);

  // Firebase Initialisation
  const app = initializeApp(firebaseConfig);

  useEffect(() => {
    const init = async () => {
      // Initialization of Service Provider
      try {
        await (tKey.serviceProvider as any).init(ethereumPrivateKeyProvider);
        setServiceProviderInitialized(true);
        uiConsole("Service Provider Initialized successfully.");
      } catch (error) {
        console.error("Service Provider Initialization Failed:", error);
        uiConsole("Service Provider Initialization Failed:", error);
        setServiceProviderInitialized(false); // Ensure it's false on error
      }
    };

    init();
  }, []);

  const signInWithGoogle = async (): Promise<UserCredential> => {
    try {
      const auth = getAuth(app);
      const googleProvider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, googleProvider);
      console.log(res);
      return res;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const login = async () => {
    if (!serviceProviderInitialized) {
      uiConsole("Service Provider not initialized yet. Please wait.");
      return;
    }
    try {
      // login with firebase
      const loginRes = await signInWithGoogle();
      // get the id token from firebase
      const idToken = await loginRes.user.getIdToken(true);
      const userId = loginRes.user.uid;

      if (!userId) {
        uiConsole("Failed to get UID from Firebase User object.");
        console.error("Firebase User object:", loginRes.user);
        return;
      }

      setUserInfo({
        uid: userId,
        displayName: loginRes.user.displayName,
      });

      const connectParams = {
        verifier,
        verifierId: userId, // loginRes.user.uid を使用
        idToken,
      };

      await (tKey.serviceProvider as SfaServiceProvider).connect(connectParams);

      await tKey.initialize();

      setTKeyInitialised(true);

      var { requiredShares } = tKey.getKeyDetails();

      if (requiredShares > 0) {
        uiConsole(
          "Please enter your backup shares, requiredShares:",
          requiredShares
        );
      } else {
        await reconstructKey();
      }
    } catch (err) {
      uiConsole("Login failed:", err, (err as Error)?.stack);
    }
  };

  const reconstructKey = async () => {
    try {
      const reconstructedKey = await tKey.reconstructKey();
      const privateKey = reconstructedKey?.privKey.toString("hex");

      await ethereumPrivateKeyProvider.setupProvider(privateKey);
      setProvider(ethereumPrivateKeyProvider);
      setLoggedIn(true);
      // setDeviceShareの呼び出しを削除
    } catch (e) {
      uiConsole(e);
    }
  };

  const inputRecoveryShare = async (share: string) => {
    try {
      await tKey.inputShare(share);
      // 必要なshareが揃ったか確認し、揃っていればreconstructKey
      const { requiredShares } = tKey.getKeyDetails();
      if (requiredShares === 0) {
        await reconstructKey();
        uiConsole("Recovery Share Input Successfully");
      } else {
        uiConsole("More shares are required.", requiredShares);
      }
    } catch (error) {
      uiConsole("Input Recovery Share Error:", error);
    }
  };

  const keyDetails = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    const keyDetails = await tKey.getKeyDetails();
    uiConsole(keyDetails);
  };

  const setDeviceShare = async () => {
    try {
      const generateShareResult = await tKey.generateNewShare();
      const share = await tKey.outputShareStore(
        generateShareResult.newShareIndex
      );
      await (tKey.modules.webStorage as WebStorageModule).storeDeviceShare(
        share
      );
      uiConsole("Device Share Set", JSON.stringify(share));
    } catch (error) {
      uiConsole("Error", (error as any)?.message.toString(), "error");
    }
  };

  const getDeviceShare = async () => {
    try {
      const share = await (
        tKey.modules.webStorage as WebStorageModule
      ).getDeviceShare();

      if (share) {
        uiConsole(
          "Device Share Captured Successfully across",
          JSON.stringify(share)
        );
        setRecoveryShare(share.share.share.toString("hex"));
        return share;
      }
      uiConsole("Device Share Not found");
      return null;
    } catch (error) {
      uiConsole("Error", (error as any)?.message.toString(), "error");
    }
  };

  const exportMnemonicShare = async () => {
    try {
      const generateShareResult = await tKey.generateNewShare();
      const share = await tKey.outputShareStore(
        generateShareResult.newShareIndex
      ).share.share;
      const mnemonic = await (
        tKey.modules.shareSerialization as ShareSerializationModule
      ).serialize(share, "mnemonic");
      uiConsole(mnemonic);
      return mnemonic;
    } catch (error) {
      uiConsole(error);
    }
  };

  const recoverFromMnemonic = async (mnemonic: string) => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    try {
      const share = await (
        tKey.modules.shareSerialization as ShareSerializationModule
      ).deserialize(mnemonic, "mnemonic");

      // ニーモニックから変換したシェアを直接inputShareに渡す
      await tKey.inputShare(share.toString("hex"));

      // シェアが揃ったか確認し、揃っていればreconstructKey
      const { requiredShares } = tKey.getKeyDetails();
      if (requiredShares === 0) {
        await reconstructKey();
        uiConsole("Recovery from Mnemonic Successful");
      } else {
        uiConsole("More shares are required.", requiredShares);
      }

      return share;
    } catch (error) {
      uiConsole("Mnemonic Recovery Error:", error);
    }
  };

  const getUserInfo = async () => {
    uiConsole(userInfo);
  };

  const logout = async () => {
    setProvider(null);
    setLoggedIn(false);
    setUserInfo({});
    uiConsole("logged out");
  };

  const getAccounts = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const web3 = new Web3(provider as any);

    // Get user's Ethereum public address
    const address = await web3.eth.getAccounts();
    uiConsole(address);
  };

  const getBalance = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const web3 = new Web3(provider as any);

    // Get user's Ethereum public address
    const address = (await web3.eth.getAccounts())[0];

    // Get user's balance in ether
    const balance = web3.utils.fromWei(
      await web3.eth.getBalance(address), // Balance is in wei
      "ether"
    );
    uiConsole(balance);
  };

  const signMessage = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const web3 = new Web3(provider as any);

    // Get user's Ethereum public address
    const fromAddress = (await web3.eth.getAccounts())[0];

    const originalMessage = "YOUR_MESSAGE";

    // Sign the message
    const signedMessage = await web3.eth.personal.sign(
      originalMessage,
      fromAddress,
      "test password!" // configure your own password here.
    );
    uiConsole(signedMessage);
  };

  const criticalResetAccount = async (): Promise<void> => {
    // This is a critical function that should only be used for testing purposes
    // Resetting your account means clearing all the metadata associated with it from the metadata server
    // The key details will be deleted from our server and you will not be able to recover your account
    if (!tKeyInitialised) {
      throw new Error("tKeyInitialised is initialised yet");
    }
    await tKey.storageLayer.setMetadata({
      privKey: tKey.serviceProvider.postboxKey,
      input: { message: "KEY_NOT_FOUND" },
    });
    uiConsole("reset");
    logout();
  };

  function uiConsole(...args: any[]): void {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
    console.log(...args);
  }

  const loggedInView = (
    <>
      <div className="flex-container">
        <div>
          <button onClick={getUserInfo} className="card">
            Get User Info
          </button>
        </div>
        <div>
          <button onClick={keyDetails} className="card">
            Key Details
          </button>
        </div>
        <div>
          <button onClick={exportMnemonicShare} className="card">
            Generate Backup (Mnemonic)
          </button>
        </div>
        <div>
          <button onClick={getAccounts} className="card">
            Get Accounts
          </button>
        </div>
        <div>
          <button onClick={getBalance} className="card">
            Get Balance
          </button>
        </div>
        <div>
          <button onClick={signMessage} className="card">
            Sign Message
          </button>
        </div>
        <div>
          <button onClick={logout} className="card">
            Log Out
          </button>
        </div>
        <div>
          <button onClick={criticalResetAccount} className="card">
            [CRITICAL] Reset Account
          </button>
        </div>
      </div>
    </>
  );

  const unloggedInView = (
    <>
      <button
        onClick={login}
        className="card"
        disabled={!serviceProviderInitialized}
      >
        {serviceProviderInitialized ? "Login" : "Initializing..."}
      </button>
      <div className={tKeyInitialised ? "" : "disabledDiv"}>
        <button onClick={() => getDeviceShare()} className="card">
          Get Device Share
        </button>
        <label>Device Share:</label>
        <input
          value={recoveryShare}
          onChange={(e) => setRecoveryShare(e.target.value)}
        ></input>
        <button
          onClick={() => inputRecoveryShare(recoveryShare)}
          className="card"
        >
          Input Device Share
        </button>
        <button onClick={criticalResetAccount} className="card">
          [CRITICAL] Reset Account
        </button>
        <label>Recover Using Mnemonic Share:</label>
        <input
          value={mnemonicShare}
          onChange={(e) => setMnemonicShare(e.target.value)}
        ></input>
        <button
          onClick={() => recoverFromMnemonic(mnemonicShare)}
          className="card"
        >
          Recover using Mnemonic
        </button>
      </div>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a
          target="_blank"
          href="https://web3auth.io/docs/sdk/core-kit/tkey"
          rel="noreferrer"
        >
          Web3Auth tKey
        </a>{" "}
        & NextJS Quick Start
      </h1>

      <div className="grid">{loggedIn ? loggedInView : unloggedInView}</div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a
          href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/tkey-web/quick-starts/tkey-nextjs-quick-start"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
