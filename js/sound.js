// ==========================================================
// 効果音管理(Web Audio APIで電子音を自作)
// iPhoneなどの自動再生制限に対応するため、
// 最初のユーザー操作時にAudioContextを有効化する
// ==========================================================

const SoundManager = (() => {
  let audioCtx = null;
  let enabled = Storage.isSoundEnabled();

  // ユーザー操作の瞬間に呼び出してAudioContextを有効化する
  function unlock() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      // iOS対策: 無音の短いバッファを一度再生してロック解除
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);
      src.start(0);
    } catch (e) {
      console.warn("AudioContextの初期化に失敗しました", e);
    }
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(v) {
    enabled = v;
    Storage.setSoundEnabled(v);
  }

  // 単音を鳴らす(音量は控えめに)
  function playTone(freq, startTime, duration, type = "sine", peakGain = 0.14) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function safePlay(fn) {
    if (!enabled) return;
    if (!audioCtx) return;
    try {
      // ブラウザによってはsuspendされたままなので再開を試みる
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      fn();
    } catch (e) {
      // 1つの効果音のエラーでゲーム全体を止めない
      console.warn("効果音の再生に失敗しました", e);
    }
  }

  // 正解音「ピンポーン」風の明るい2音
  function playCorrect() {
    safePlay(() => {
      const t = audioCtx.currentTime;
      playTone(880, t, 0.18, "sine", 0.16);
      playTone(1318.5, t + 0.14, 0.28, "sine", 0.16);
    });
  }

  // 不正解音「ブブー」風の低い2音
  function playWrong() {
    safePlay(() => {
      const t = audioCtx.currentTime;
      playTone(196, t, 0.22, "sawtooth", 0.11);
      playTone(146.8, t + 0.2, 0.32, "sawtooth", 0.11);
    });
  }

  // 198問全問正解専用ファンファーレ
  function playFanfare() {
    safePlay(() => {
      const t = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => {
        playTone(f, t + i * 0.14, 0.35, "triangle", 0.15);
      });
    });
  }

  return { unlock, isEnabled, setEnabled, playCorrect, playWrong, playFanfare };
})();
