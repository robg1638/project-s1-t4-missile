class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "gameScene" });
    }

    preload() {
        this.load.image("background", "/assets/background.png");
        this.load.image("stars", "/assets/background-stars.png");
        this.load.image("tankbody", "/assets/tankbody.png");
        this.load.spritesheet("tankbarrel", "/assets/tankbarrel.png", {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.image("missile", "/assets/missile.png");
        this.load.image("comet", "/assets/comet.png");
        this.load.spritesheet("explosion", "/assets/explosion.png", {
            frameWidth: 16,
            frameHeight: 16,
        });
        this.load.image("base", "/assets/base.png");
        this.load.image("button", "/assets/button.png");
    }

    create() {
        let self = this;

        //Load background
        this.add.image(640, 360, "background").setScale(5);
        this.add.image(640, 360, "stars").setScale(4);
        this.add.image(640, 820, "base").setScale(15);

        //Create animations
        this.anims.create({
            key: "explode",
            frameRate: 10,
            frames: this.anims.generateFrameNames("explosion", {
                start: 0,
                end: 4,
            }),
        });
        this.anims.create({
            key: "fire",
            frameRate: 15,
            frames: this.anims.generateFrameNames("tankbarrel", {
                start: 1,
                end: 7,
            }),
        });

        //Load socket
        this.socket = io();

        //Groups
        this.missiles = this.physics.add.group();
        this.comets = this.physics.add.group();
        this.otherPlayers = this.physics.add.group();
        this.otherTankbodys = this.physics.add.group();

        this.speedUpgradeText = this.add
            .text(1190, 25, "Missile\nSpeed\n\n1000", { fontSize: "18px" })
            .setDepth(3);
        this.speedUpgrade = this.add
            .image(1230, 50, "button")
            .setDepth(2)
            .setScale(1.5)
            .setTint(0xcfcfcf)
            .setInteractive();

        this.speedUpgrade
            .on("pointerover", () => {
                this.speedUpgrade.setTint(0xfcfcfc);
            })
            .on("pointerout", () => {
                this.speedUpgrade.setTint(0xcfcfcf);
            })
            .on("pointerdown", () => {
                this.socket.emit("attemptUpgrade", "speed");
            });

        //Game variables
        this.shot = false;

        //Initializing server-handled objects
        this.socket.on("initHealth", (baseHealth) => {
            this.healthText = this.add.text(50, 100, `Health: ${baseHealth}`, {
                fontSize: "24px",
            });
        });
        this.socket.on("initTimer", (timer) => {
            this.timerText = this.add.text(50, 50, `Time: ${timer}`, {
                fontSize: "24px",
            });
        });
        this.socket.on("initCredits", (cred) => {
            this.creditText = this.add.text(50, 150, `Credits: ${cred}`, {
                fontSize: "24px",
            });
        });
        this.socket.on("initScore", (score) => {
            this.scoreText = this.add.text(50, 200, `Score: ${score}`, {
                fontSize: "24px",
            });
        });
        this.socket.on("currentPlayers", (players) => {
            Object.keys(players).forEach((id) => {
                if (players[id].playerId === self.socket.id) {
                    self.addPlayer(self, players[id]);
                } else {
                    self.addOtherPlayers(self, players[id]);
                }
            });
        });
        this.socket.on("initComets", (serverComets) => {
            Object.keys(serverComets).forEach((comet) => {
                if (comet != undefined) {
                    self.addComet(self, serverComets[comet]);
                }
            });
        });

        //Events where new objects are created
        this.socket.on("newPlayer", (playerInfo) => {
            self.addOtherPlayers(self, playerInfo);
        });
        this.socket.on("newMissile", (missileInfo) => {
            self.addMissile(self, missileInfo);
        });
        this.socket.on("missileFired", (id) => {
            self.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (id == otherPlayer.playerId) {
                    otherPlayer.play("fire");
                }
            });
        });
        this.socket.on("newComet", (cometInfo) => {
            self.addComet(self, cometInfo);
        });

        //Events where objects are destroyed
        this.socket.on("missileDestroyed", (missileId) => {
            self.missiles.getChildren().forEach((missile) => {
                if (missile.id == missileId) {
                    const explosion = this.add
                        .sprite(missile.x, missile.y, "explosion", 0)
                        .setScale(5);
                    explosion.play("explode");
                    // TODO: make explosion length animation reflect its duration
                    // TODO: make explosion size reflect its size
                    //explosion.anims.msPerFrame = 500;
                    explosion.once(
                        Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,
                        () => {
                            explosion.destroy();
                        }
                    );
                    missile.destroy();
                }
            });
        });

        this.socket.on("cometDestroyed", (cometId) => {
            self.comets.getChildren().forEach((comet) => {
                if (comet.id == cometId) {
                    const explosion = this.add
                        .sprite(comet.x, comet.y, "explosion", 0)
                        .setScale(5);
                    explosion.play("explode");
                    // TODO: make explosion length animation reflect its duration
                    // TODO: make explosion size reflect its size
                    //explosion.anims.msPerFrame = 500;
                    explosion.once(
                        Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,
                        () => {
                            explosion.destroy();
                        }
                    );
                    comet.destroy();
                }
            });
        });

        this.socket.on("disconnect", (playerId) => {
            self.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (playerId === otherPlayer.playerId) {
                    otherPlayer.destroy();
                }
            });
            self.otherTankbodys.getChildren().forEach((otherTankbody) => {
                if (playerId === otherTankbody.playerId) {
                    otherTankbody.destroy();
                }
            });
        });

        this.socket.on("gameOver", () => {
            this.scene.switch("endScene");
        });

        //Events where object states are updated
        this.socket.on("baseDamaged", (info) => {
            self.comets.getChildren().forEach((comet) => {
                if (comet.id == info[0]) {
                    this.healthText.setText(`Health: ${info[1]}`);
                    const explosion = this.add
                        .sprite(comet.x, comet.y, "explosion", 0)
                        .setScale(5);
                    explosion.play("explode");
                    explosion.once(
                        Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,
                        () => {
                            explosion.destroy();
                        }
                    );
                    comet.destroy();
                }
            });
        });
        this.socket.on("missileUpdate", (serverMissiles) => {
            self.missiles.getChildren().forEach((missile) => {
                missile.setPosition(
                    serverMissiles[missile.id].x,
                    serverMissiles[missile.id].y
                );
            });
        });
        this.socket.on("cometUpdate", (serverComets) => {
            self.comets.getChildren().forEach((comet) => {
                if (serverComets[comet.id] != undefined) {
                    comet.setPosition(
                        serverComets[comet.id].x,
                        serverComets[comet.id].y
                    );
                }
            });
        });
        this.socket.on("playerMoved", (playerInfo) => {
            self.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                }
            });
        });
        this.socket.on("timerUpdate", (timer) => {
            this.timerText.setText(`Time: ${timer}`);
        });
        this.socket.on("updateCredits", (credits) => {
            this.creditText.setText(`Credits: ${credits}`);
        });
        this.socket.on("updateScore", (score) => {
            this.scoreText.setText(`Score: ${score}`);
        });
        this.socket.on("updateCost", (info) => {
            if (info[0] == "speed") {
                this.speedUpgradeText.setText(`Missile\nSpeed\n\n${info[1]}`);
            }
        });
    }

    update() {
        if (this.ship) {
            //Mouse handling
            let pointer = this.input.activePointer;
            let mvtAngle = Math.atan2(
                pointer.y - this.ship.y,
                pointer.x - this.ship.x
            );
            if (mvtAngle > 0.0) {
                if (mvtAngle < Math.PI * 0.5) {
                    mvtAngle = 0.0;
                } else {
                    mvtAngle = Math.PI;
                }
            }

            //instant rotation change
            this.ship.rotation = mvtAngle + Math.PI * 0.5;
            //the commented out section would have made the movement smooth, we longer want that
            /*let diffAngle = mvtAngle - (this.ship.rotation - Math.PI * 0.5);
            if (diffAngle > Math.PI) {
                diffAngle -= Math.PI * 2.0;
            }
            if (diffAngle < -Math.PI) {
                diffAngle += Math.PI * 2.0;
            }
            this.ship.setAngularVelocity(600 * diffAngle);*/
            this.socket.emit("rotationChange", this.ship.rotation);

            //Shot handling
            if (!this.shot && pointer.isDown) {
                this.shot = true;
                this.ship.play("fire");
                this.socket.emit("missileShot", {
                    x: this.ship.x,
                    y: this.ship.y,
                    mouseX: pointer.x,
                    mouseY: pointer.y,
                    rotation: this.ship.rotation,
                });
            }

            if (!pointer.isDown) {
                this.shot = false;
            }
        }
    }

    //Helper add functions
    addTankBody(self, playerInfo) {
        return self.add
            .sprite(playerInfo.x, playerInfo.y - 10, "tankbody")
            .setScale(1.25);
    }

    addPlayer(self, playerInfo) {
        self.addTankBody(self, playerInfo);
        self.ship = self.physics.add
            .sprite(playerInfo.x, playerInfo.y - 10, "tankbarrel")
            .setScale(1.25);
        self.ship.setDrag(0);
        self.ship.setAngularDrag(0);
        self.ship.setMaxVelocity(10000);
    }

    addOtherPlayers(self, playerInfo) {
        const otherTankbody = self.addTankBody(self, playerInfo);
        const otherPlayer = self.add
            .sprite(playerInfo.x, playerInfo.y - 10, "tankbarrel")
            .setScale(1.25);
        otherPlayer.playerId = playerInfo.playerId;
        otherTankbody.playerId = playerInfo.playerId;
        self.otherPlayers.add(otherPlayer);
        self.otherTankbodys.add(otherTankbody);
    }

    addMissile(self, missileInfo) {
        const missile = self.add.sprite(
            missileInfo.x,
            missileInfo.y,
            "missile"
        );
        missile.rotation = missileInfo.rotation;
        missile.id = missileInfo.id;
        self.missiles.add(missile);
    }

    addComet(self, cometInfo) {
        const comet = self.add
            .sprite(cometInfo.x, cometInfo.y, "comet")
            .setDisplaySize(23, 60);
        comet.rotation = cometInfo.rotation;
        comet.id = cometInfo.id;
        self.comets.add(comet);
    }
}

export default GameScene;
