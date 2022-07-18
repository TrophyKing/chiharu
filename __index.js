let lastAddress = Utils.provider && Utils.provider.account ? Utils.account : null;

let lastTimeChecked = new Date().getTime();

window.onload = () => {
    console.log("DOM/Window loaded.");

    Utils.setProvider(window.provider)
        .then((result) => {
            console.log("Provider Ready.");
        })
        .catch((error) => {
            console.error(error);
        });

    Utils.provider.on("addressChanged", async () => {
        console.log("[INFO] Address changed.");

        await Utils.setProvider(window.provider).then(() => {
            if (GatewayClient) {
                GatewayClient.Socket.emit("initPlayer", {
                    token: Game.token,
                });
            }

            refreshSignedValues();

            if (GatewayClient.Socket) {
                getAbandonedGames();
            }
        });
    });

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("Trophy King identity authenticated.", user);
        } else {
            console.log("Unable to authenticate Trophy King identity.");
        }
    });
};
