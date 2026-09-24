import Phaser from 'phaser';

// Runtime-loaded asset pack (lives in public/assets/, copied verbatim to dist/assets/)
const ASSET_BASE = './assets/';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    this.load.atlas('pack', ASSET_BASE + 'atlas.png', ASSET_BASE + 'atlas.json');
  }
  create() {
    const a = this.add.sprite(120, 90, 'pack', 'hero_0');
    const b = this.add.sprite(240, 90, 'pack', 'hero_1');
    a.setScale(0.5); b.setScale(0.5);
    window.__PROBE__ = {
      phaser: Phaser.VERSION,
      renderer: this.game.renderer.type === Phaser.WEBGL ? 'WEBGL' : 'CANVAS',
      frames: this.textures.get('pack').getFrameNames(),
      docUrl: document.location.href,
    };
    console.log('PROBE_READY ' + JSON.stringify(window.__PROBE__));
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 320,
  height: 180,
  parent: 'game',
  backgroundColor: '#101820',
  scene: [BootScene],
});

game.events.once('ready', () => { window.__GAME_EVENT_READY__ = true; });
