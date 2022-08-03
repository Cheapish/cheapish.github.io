const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const contractAddress = "0x64bd5A3F0f426Af103E250df611f2fF0b9706a63";

var web3;
var web3Modal;
var provider;
var selectedAccount;
var contract;

var logNameInput = document.querySelector("#log-name");
var connectedWalletUI = document.querySelector("#connected");

function init() {
  Telegram.WebApp.expand();
  Telegram.WebApp.ready();
  Telegram.WebApp.MainButton
    .setText("CONNECT WALLET")
    .onClick(onConnect)
    .show();

  web3Modal = new Web3Modal({
    cacheProvider: false,
    providerOptions: {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          rpc: {
            10001: "https://moeing.tech:9545"
          }
        }
      }
    }
  });
}

async function callGetUsersMethod() {
  let users = await contract.methods.getUsers().call();

  // Get a handle
  const template = document.querySelector("#template-users");
  const usersContainer = document.querySelector("#users");

  // Purge UI elements any previously loaded accounts
  usersContainer.innerHTML = "";

  // Go through all accounts and get their ETH balance
  const rowResolvers = users.map(async userData => {
    // Fill in the templated row and put in the document
    const clone = template.content.cloneNode(true);
    clone.querySelector(".name").textContent = userData[0];
    // calls is a BigNumber (BN.js) instance
    clone.querySelector(".calls").textContent = userData[1].toString();
    usersContainer.appendChild(clone);
  });

  await Promise.all(rowResolvers);
}

async function fetchAccountData() {

  const accounts = await web3.eth.getAccounts();

  selectedAccount = accounts[0];

  document.querySelector("#selected-account").textContent = selectedAccount;

  const template = document.querySelector("#template-balance");
  const accountContainer = document.querySelector("#accounts");

  accountContainer.innerHTML = "";

  const rowResolvers = accounts.map(async (address) => {
    const balance = await web3.eth.getBalance(address);
    const nativeBalance = web3.utils.fromWei(balance, "ether");
    const humanFriendlyBalance = parseFloat(nativeBalance).toFixed(4);
    const clone = template.content.cloneNode(true);
    clone.querySelector(".address").textContent = address;
    clone.querySelector(".balance").textContent = humanFriendlyBalance;
    accountContainer.appendChild(clone);
  });

  await Promise.all(rowResolvers);

  connectedWalletUI.style.display = "block";
}

async function refreshAccountData() {
  connectedWalletUI.style.display = "none";
  Telegram.WebApp.MainButton.disable();
  await fetchAccountData(provider);
  Telegram.WebApp.MainButton.enable();
}

async function onConnect() {
  Telegram.WebApp.MainButton.disable();
  
  try {
    provider = await web3Modal.connect();
  } catch(e) {
    Telegram.WebApp.MainButton.enable();
    window.alert(e.message);
    return;
  }

  Telegram.WebApp.MainButton.showProgress();

  provider.on("accountsChanged", accounts => fetchAccountData());
  provider.on("chainChanged", chainId => fetchAccountData());

  web3 = new Web3(provider);

  let contractFile = await fetch("assets/abi/WeMove.json");
  let contractJSON = await contractFile.json();
  contract = new web3.eth.Contract(contractJSON.abi, contractAddress);

  await refreshAccountData();
  await callGetUsersMethod();

  Telegram.WebApp.MainButton
    .setText("DISCONNECT WALLET")
    .onClick(onDisconnect)
    .enable();

  Telegram.WebApp.MainButton.hideProgress();
}

async function onDisconnect() {

  if (provider.close) {
    await provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behaviour.
    await web3Modal.clearCachedProvider();
    provider = null;
  }

  selectedAccount = null;
  connectedWalletUI.style.display = "none";

  Telegram.WebApp.close();
}

async function logBtn() {
  let inputValue = logNameInput.value.trim();

  if (inputValue.length === 0) {
    return window.alert("Nothing was entered into the text field.");
  }

  Telegram.WebApp.MainButton.showProgress();

  try {
    let estimatedGas = await contract.methods
      .log(inputValue)
      .estimateGas({from:selectedAccount});

    await contract.methods
      .log(inputValue)
      .send({from:selectedAccount, gasLimit:estimatedGas});
  } catch(e) {
    let errorJson = JSON.parse(
      e.message.substring(e.message.indexOf("{"), e.message.length)
    );
    Telegram.WebApp.MainButton.hideProgress();
    window.alert(errorJson.message);
    return;
  }

  Telegram.WebApp.MainButton.hideProgress();
  window.alert("Successfully logged your name.")
  logNameInput.value = "";
}

async function callBtn() {
  Telegram.WebApp.MainButton.showProgress();

  try {
    let estimatedGas = await contract.methods
      .call()
      .estimateGas({from:selectedAccount});

    await contract.methods
      .call()
      .send({from:selectedAccount, gasLimit:estimatedGas});
  } catch(e) {
    let errorJson = JSON.parse(
      e.message.substring(e.message.indexOf("{"), e.message.length)
    );
    Telegram.WebApp.MainButton.hideProgress();
    window.alert(errorJson.message);
    return;
  }

  Telegram.WebApp.MainButton.hideProgress();
  window.alert("Successfully incremented the number of times you've interacted with the smart contract.")
}

async function checkNameBtn() {
  Telegram.WebApp.MainButton.showProgress();
  let name = await contract.methods.checkMyName().call({from:selectedAccount});
  Telegram.WebApp.MainButton.hideProgress();
  window.alert(`The name you logged was ${name}.`);
}

async function checkCallsBtn() {
  Telegram.WebApp.MainButton.showProgress();
  let num = await contract.methods.checkMyNumberOfCalls().call({from:selectedAccount});
  Telegram.WebApp.MainButton.hideProgress();
  window.alert(`You've called the contract ${num.toString()} times.`);
}

window.addEventListener("load", async () => {
  init();

  document.querySelector("#log-btn").addEventListener("click", logBtn);
  document.querySelector("#call-btn").addEventListener("click", callBtn);
  document.querySelector("#check-name-btn").addEventListener("click", checkNameBtn);
  document.querySelector("#check-calls-btn").addEventListener("click", checkCallsBtn);
});

