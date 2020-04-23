class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'gameScene' });
    }

    preload() {
        this.load.image('background', '/assets/background.png');
        this.load.image('stars', '/assets/background-stars.png');
        this.load.image('tankbody', '/assets/tankbody.png')
        this.load.spritesheet('tankbarrel', '/assets/tankbarrel.png', { frameWidth: 128, frameHeight: 128 })
        this.load.image('missile', '/assets/missile.png')
        this.load.image('comet', '/assets/comet.png')
        this.load.spritesheet('explosion', '/assets/explosion.png', { frameWidth: 16, frameHeight: 16 })
        this.load.image('base', '/assets/base.png')
    }

    create() {
        let self = this;

        //Load background
        this.add.image(640, 360, 'background').setScale(5);
        this.add.image(640, 360, 'stars').setScale(4);
        this.add.image(640, 820, 'base').setScale(15);

        //Create animations
        this.anims.create({
            key: 'explode',
            frameRate: 10,
            frames: this.anims.generateFrameNames('explosion', { start: 0, end: 4 })
        })
        this.anims.create({
            key: 'fire',
            frameRate: 15,
            frames: this.anims.generateFrameNames('tankbarrel', { start: 1, end: 7 })
        })

        //Load socket
        this.socket = io();

        //Groups
        this.missiles = this.physics.add.group();
        this.comets = this.physics.add.group();
        this.otherPlayers = this.physics.add.group(); 
        this.otherTankbodys = this.physics.add.group();

        //Game variables
        this.shot = false;

        //Initializing server-handled objects
        this.socket.on('initHealth', baseHealth => {
            this.healthText = this.add.text(50, 100, `Health: ${baseHealth}`, { fontSize: '24px' })
        })
        this.socket.on('initTimer', timer => {
            this.timerText = this.add.text(50, 50, `Time: ${timer}`, { fontSize: '24px' });
        })
        this.socket.on('currentPlayers', function (players) {
            Object.keys(players).forEach(function (id) {
                if (players[id].playerId === self.socket.id) {
                    self.addPlayer(self, players[id]); //pass current player info and reference to current scene
                } else {
                    self.addOtherPlayers(self, players[id]);
                }
            })
        })
        this.socket.on('initComets', serverComets => {
            Object.keys(serverComets).forEach(comet => {
                if (comet != undefined) {
                    self.addComet(self, serverComets[comet]);
                }
            })
        })

        //Events where new objects are created
        this.socket.on('newPlayer', function (playerInfo) {
            self.addOtherPlayers(self, playerInfo); 
        })
        this.socket.on('newMissile', function (missileInfo) {
            self.addMissile(self, missileInfo);
        })
        this.socket.on('missileFired', id => {
            self.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (id == otherPlayer.playerId) {
                    otherPlayer.play('fire');
                }
            })
        })
        this.socket.on('newComet', cometInfo => {
            self.addComet(self, cometInfo);
        })

        //Events where objects are destroyed
        this.socket.on('missileDestroyed', missileId => {
            self.missiles.getChildren().forEach(missile => {
                if (missile.id == missileId) {
                    const explosion = this.add.sprite(missile.x, missile.y, 'explosion', 0).setScale(5);
                    explosion.play('explode');
                    explosion.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => { explosion.destroy() })
                    missile.destroy();
                }
            })
        })
        this.socket.on('cometDestroyed', cometId => {
            self.comets.getChildren().forEach(comet => {
                if (comet.id == cometId) {
                    comet.destroy();
                }
            })
        })
        this.socket.on('disconnect', function (playerId) {
            self.otherPlayers.getChildren().forEach(function (otherPlayer) { //getChildren() returns all members of a group in an array
                if (playerId === otherPlayer.playerId) { //Removes the game object from the game
                    otherPlayer.destroy();
                }
            })
            self.otherTankbodys.getChildren().forEach(function (otherTankbody) {
                if (playerId === otherTankbody.playerId) {
                    otherTankbody.destroy();
                }
            })
        })

        //Events where object states are updated
        this.socket.on('baseDamaged', info => {
            self.comets.getChildren().forEach(comet => {
                if (comet.id == info[0]) {
                    this.healthText.setText(`Health: ${info[1]}`);
                    const explosion = this.add.sprite(comet.x, comet.y, 'explosion', 0).setScale(5);
                    explosion.play('explode');
                    explosion.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => { explosion.destroy() })
                    comet.destroy();
                }
            })
        })
        this.socket.on('missileUpdate', serverMissiles => {
            self.missiles.getChildren().forEach(missile => {
                missile.setPosition(serverMissiles[missile.id].x, serverMissiles[missile.id].y);
            })
        })
        this.socket.on('cometUpdate', serverComets => {
            self.comets.getChildren().forEach(comet => {
                if (serverComets[comet.id] != undefined) {
                    comet.setPosition(serverComets[comet.id].x, serverComets[comet.id].y);
                }
            })
        })
        this.socket.on('playerMoved', playerInfo => {
            self.otherPlayers.getChildren().forEach(otherPlayer => {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                }
            })
        })
        this.socket.on('timerUpdate', timer => {
            this.timerText.setText(`Time: ${timer}`);
        })
    }

    update() {
        if (this.ship) {
            //Mouse handling
            let pointer = this.input.activePointer;
            let mvtAngle = Math.atan2(pointer.y - this.ship.y, pointer.x - this.ship.x);
            if (mvtAngle > 0.0) { 
                if (mvtAngle < Math.PI * 0.5) { 
                    mvtAngle = 0.0;
                }
                else { 
                    mvtAngle = Math.PI;
                }
            }
            let diffAngle = mvtAngle - (this.ship.rotation - Math.PI * 0.5);
            if (diffAngle > Math.PI) {
                diffAngle -= Math.PI * 2.0;
            }
            if (diffAngle < -Math.PI) {
                diffAngle += Math.PI * 2.0;
            }
            this.ship.setAngularVelocity(600 * diffAngle);
            this.socket.emit('rotationChange', this.ship.rotation);
    
            //Shot handling
            if (!this.shot && pointer.isDown) {
                this.shot = true;
                this.ship.play('fire');
                this.socket.emit('missileShot', {
                    x: this.ship.x,
                    y: this.ship.y,
                    rotation: this.ship.rotation,
                    speedX: -1 * Math.cos(this.ship.rotation + Math.PI / 2) * 20,
                    speedY: -1 * Math.sin(this.ship.rotation + Math.PI / 2) * 20,
                    dmg: 1,
                    radius: 75
                })
            }
            if (!pointer.isDown) {
                this.shot = false;
            }
    
        }
    }

    //Helper add functions
    addTankBody(self, playerInfo) {
        return self.add.sprite(playerInfo.x, playerInfo.y - 10, 'tankbody').setScale(1.25);
    }
    
    addPlayer(self, playerInfo) {
        self.addTankBody(self, playerInfo);
        self.ship = self.physics.add.sprite(playerInfo.x, playerInfo.y - 10, 'tankbarrel').setScale(1.25);
        self.ship.setDrag(100); 
        self.ship.setAngularDrag(100);
        self.ship.setMaxVelocity(200); 
    }
    
    addOtherPlayers(self, playerInfo) {
        const otherTankbody = self.addTankBody(self, playerInfo);
        const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y - 10, 'tankbarrel').setScale(1.25);
        otherPlayer.playerId = playerInfo.playerId;
        otherTankbody.playerId = playerInfo.playerId;
        self.otherPlayers.add(otherPlayer); 
        self.otherTankbodys.add(otherTankbody);
    }
    
    addMissile(self, missileInfo) {
        const missile = self.add.sprite(missileInfo.x, missileInfo.y, 'missile');
        missile.rotation = missileInfo.rotation;
        missile.id = missileInfo.id;
        self.missiles.add(missile);
    }
    
    addComet(self, cometInfo) {
        const comet = self.add.sprite(cometInfo.x, cometInfo.y, 'comet').setDisplaySize(23, 60);
        comet.rotation = cometInfo.rotation;
        comet.id = cometInfo.id;
        self.comets.add(comet);
    }
}

export default GameScene;