import ThresholdKey from "@tkey/core";
import SFAServiceProvider from "@tkey/service-provider-sfa";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import { ShareSerializationModule } from "@tkey/share-serialization";
import { WebStorageModule } from "@tkey/web-storage";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

const clientId =
  "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ"; // get from https://dashboard.web3auth.io

const chainConfig = {
  chainId: "0xaa36a7",
  rpcTarget:
    "https://eth-sepolia.g.alchemy.com/v2/HG0QWro5aeI5ml7ya5H7gEXhWMS0MOgV",
  displayName: "sepolia",
  blockExplorer: "https://sepolia.etherscan.io/",
  ticker: "ETH",
  tickerName: "Ethereum",
};

const web3AuthOptions: any = {
  clientId, // Get your Client ID from Web3Auth Dashboard
  chainConfig,
  web3AuthNetwork: "sapphire_mainnet",
};

// Configuration of Service Provider
const serviceProvider = new SFAServiceProvider({ web3AuthOptions });

export const ethereumPrivateKeyProvider = new EthereumPrivateKeyProvider({
  config: {
    chainConfig,
  },
});

// Instantiation of Storage Layer
const storageLayer = new TorusStorageLayer({
  hostUrl: "https://metadata.tor.us",
});

// Configuration of Modules
const webStorageModule = new WebStorageModule();
const shareSerializationModule = new ShareSerializationModule();

// Instantiation of tKey
export const tKey = new ThresholdKey({
  serviceProvider,
  storageLayer,
  modules: {
    shareSerialization: shareSerializationModule,
    webStorage: webStorageModule,
  },
});
