const ARCADE_ADDRESS = "0x1Cf5081614791Aa3B18500bAF64cAbfb2D467628";

const KING_ADDRESS = "0xCBa49b070F522F3A580C02DbFB5464EFe2cC3Ea1";

const HOST_URL = "https://polygon-mumbai.infura.io/v3/48e08d3cdaa14b3585dbffa02ca36d1a";

const TXN_PARAMS = (txn) => {
    return {
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txn],
        id: 1,
    };
};

let denominations = ["K", "M", "B", "T"];

const _abbreviate = (value, decimals) => {
    const _decimals = Math.pow(10, decimals);

    const abbreviation = {};

    for (let i = denominations.length - 1; i >= 0; i--) {
        let size = Math.pow(10, (i + 1) * 3);

        if (size <= value) {
            value = Math.round((value * _decimals) / size) / _decimals;

            if (value === 1000 && i < denominations.length - 1) {
                value = 1;
                i++;
            }

            abbreviation.value = value;
            abbreviation.denomination = denominations[i];

            break;
        } else {
            abbreviation.value = value.toFixed(decimals);
            abbreviation.denomination = "";
        }
    }

    return abbreviation;
};

const abbreviateValue = (value, decimals) => {
    let isNegative = value < 0;
    let isZero = value === 0;
    let abbreviatedValue = _abbreviate(Math.abs(value), decimals || 0);

    return isNegative ? {
        ...abbreviatedValue,
        value: "-" + abbreviatedValue.value,
    } : isZero ? {
        ...abbreviatedValue,
        value: 0,
    } : abbreviatedValue;
};

const authenticateUser = (token) => {
    firebase
        .auth()
        .signInWithCustomToken(token)
        .catch((error) => {
            let errorCode = error.code;
            let errorMessage = error.message;

            console.error(errorCode, errorMessage);
        });
};

const isMobile = () => {
    const toMatch = [/Android/i, /webOS/i, /iPhone/i, /iPad/i, /iPod/i, /BlackBerry/i, /Windows Phone/i];

    return toMatch.some((toMatchItem) => {
        return navigator.userAgent.match(toMatchItem);
    });
};

const getAbandonedGames = () => {
    window.abandoned = [];

    const collection = window.db.collection("chiharu_games");
    const query = collection.orderBy("timeCreated", "desc");
    const me = R.pathOr(null, ["provider", "defaultAddress", "base58"], Utils);

    query
        .get()
        .then((snapshot) => {
            if (snapshot.docs.length > 0) {
                const { docs } = snapshot;

                docs.forEach((doc) => {
                    const game = doc.data();

                    const events = pathOr(null, ["events"], game);
                    const refundable = pathOr(null, ["refundable"], game);
                    const isAbandoned = R.propEq("type", "abandoned");
                    const isPlayer = R.propEq("player", me);
                    const isRefund = R.propEq("type", "refund");
                    const isRefundPlayer = R.propEq("id", me);
                    const abandoned = R.find(R.both(isAbandoned, isPlayer))(events);
                    const refunded = R.find(R.both(isRefund, isRefundPlayer))(events);
                    const status = pathOr(null, ["status"], abandoned);
                    const reconciled = pathOr(false, ["abandoned"], refunded);

                    if (status === "open" && refundable && reconciled === false) {
                        window.abandoned.push(abandoned);
                    }
                });
            }

            if (window.abandoned.length > 0) {
                Hud.ShowAbandonedMenu();
            }
        })
        .catch((error) => {
            console.error(error);
        });
};

const getNetworkIcon = () => {
    return '<img src="https://tk-assets.sfo2.digitaloceanspaces.com/chiharu/footer/footer-matic.png" style="display:inline-block;width:32px;height:32px;"/>';
}

const refreshSignedValues = () => {
    const timeNow = new Date().getTime();

    let timeSinceLastChecked = timeNow - lastTimeChecked;

    if (lastAddress !== Utils.account) {
        lastAddress = Utils.account;
        timeSinceLastChecked += 3250;
    }

    if (Utils.provider && timeSinceLastChecked > 3250) {
        lastTimeChecked = new Date().getTime();

        Utils.provider
            .getBalance(Utils.account)
            .then((balance) => {
                const { value, denomination } = abbreviateValue(balance !== null && !Number.isNaN(+balance) ? Number(+balance / 1e18) : 0.0, 3);

                document.getElementById("network-wallet-balance").innerHTML = '<span class="network-value">' + value + denomination + '<span class="network-denomination"> $MATIC</span>';
            })
            .catch((err) => {
                console.error(err);
            });

        if (Utils.contract && Utils.contract["token"]) {
            (async () => {
                const balanceTrophyKing = +(await Utils.contract["token"].balanceOf(Utils.account));

                const { value, denomination } = abbreviateValue(balanceTrophyKing !== null && !Number.isNaN(+balanceTrophyKing) ? Number(+balanceTrophyKing / 1e18) : 0.0, 3);

                if (Hud.kingBalance) {
                    Hud.kingBalance.innerHTML = '<span class="king-value">' + value + denomination + '<span class="king-denomination"> $KING</span>';
                }

                window.Utils.allowance = await Utils.contract["token"].allowance(Utils.account, ARCADE_ADDRESS);

                Game.approved = window.Utils.allowance >= GameClient.networkRegistrationFee;

                if (Game.approved) {
                    Hud.lobbySettings.innerHTML = "";
                } else {
                    Hud.lobbySettings.innerHTML = '<span class="circle pulse" />';
                }

                if (Hud.kingAllowance) {
                    const { value, denomination } = abbreviateValue(window.Utils.allowance !== null && !Number.isNaN(+window.Utils.allowance) ? Number(+window.Utils.allowance / 1e18) : 0.0, 3);

                    Hud.lobbySettingsApproveSliderInput.min = window.Utils.allowance;
                    Hud.kingAllowance.innerHTML = '<span>ALLOWANCE:&nbsp;</span>' +
                        '<span style="vertical-align: middle;line-height: 32px;display: inline-flex;margin: 0.75rem auto 1.25rem;">' +
                        '<img src="//tk-assets.sfo2.digitaloceanspaces.com/chiharu/footer/footer-king.png" style="display:inline-block;width:32px;height:32px;margin:0 5px 0 10px;vertical-align: middle;"/>' +
                        '&nbsp;<span class="king-value" style="vertical-align: middle;">' + value + denomination + '<span class="king-denomination">&nbsp;$KING</span></span>' +
                        '</span>';
                }
            })();
        }

        if (Game) {
            Game.token = Utils.account;
        }

        if (Hud && Game.authenticated && Game.approved) {
            Hud.kingButton.className = "king lobby-button";
            // Hud.tewkenButton.className = "tewken lobby-button";
            // Hud.diamondButton.className = "diamond lobby-button";
            // Hud.platinumButton.className = "platinum lobby-button";
            // Hud.goldButton.className = "gold lobby-button";
            // Hud.silverButton.className = "silver lobby-button";
            // Hud.bronzeButton.className = "bronze lobby-button";
            // Hud.deflatingButton.className = "deflating lobby-button";
            // Hud.stakingButton.className = "staking lobby-button";
            // Hud.emergingButton.className = "emerging lobby-button";
            // Hud.practiceButton.className = "practice lobby-button";
            // Hud.miningButton.className = "mining";
            // const miningLobbyFee = document.getElementById("mining-lobby-fee");
            //
            // if (miningLobbyFee) {
            //     miningLobbyFee.innerHTML = "OPEN";
            // }
        }

        window.stats = [];
        window.points = [];
    }
};

window.Utils = {
    account: false,
    signer: false,
    provider: false,
    contract: {},
    nonce: false,

    async setProvider() {
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.account = (await this.provider.send("eth_requestAccounts", []))[0];
        this.signer = this.provider.getSigner(this.account);
        this.contract["arcade"] = new ethers.Contract(ARCADE_ADDRESS, arcadeInterface, this.signer);
        this.contract["token"] = new ethers.Contract(KING_ADDRESS, standardInterface, this.signer);
        this.nonce = await this.provider.getTransactionCount(this.account);

        return this;
    },
};