var vad = require('./vad.js');

(function () {
    // TODO: PWA
    var ONE_SECOND = 1000;
    var AUDIO_THRESHOLD = 0.5;

    function requestMic(handleSuccess, handleError) {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();

            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
            navigator.getUserMedia({audio: true}, handleSuccess, handleError);
        } catch (e) {
            handleError();
        }
    }

    var INITIAL_GRIND_LEVEL = 5;
    try {
        INITIAL_GRIND_LEVEL = window.localStorage.getItem('grindLevel') || INITIAL_GRIND_LEVEL;
    } catch {
    }

    var INITIAL_PREINFUSION_TIMER = 4;
    try {
        INITIAL_PREINFUSION_TIMER = window.localStorage.getItem('preinfusionTimer') || INITIAL_PREINFUSION_TIMER;
    } catch {
    }

    var INITIAL_TOTAL_TIMER = 25;
    try {
        INITIAL_TOTAL_TIMER = window.localStorage.getItem('totalTimer') || INITIAL_TOTAL_TIMER;
    } catch {
    }

    var INITIAL_HISTORY = [];
    try {
        INITIAL_HISTORY = JSON.parse(window.localStorage.getItem('history')) || INITIAL_HISTORY;
    } catch {
    }

    var app = new Vue({
        el: '#app',
        vuetify: new Vuetify(),
        data: {
            audioTick: new Audio('./tick.mp3?cache-buster=' + Date.now()),
            audioEnd: new Audio('./end.mp3?cache-buster=' + Date.now()),
            dialogAudio: false,
            dialogDelete: false,
            hasTimed: false,
            interval: null,
            grindLevel: INITIAL_GRIND_LEVEL,
            initialPreinfusionTimer: null,
            preinfusionTimer: INITIAL_PREINFUSION_TIMER,
            initialTotalTimer: null,
            totalTimer: INITIAL_TOTAL_TIMER,
            extraTotalTime: 0,
            shouldUseAudio: false,
            voiceDetector: null,
            voiceActivityStartDate: new Date(0),
            history: INITIAL_HISTORY,
            historyHeaders: [
                {
                    text: 'Grind level',
                    value: 'grindLevel',
                },
                {
                    text: 'Pre-infusion time',
                    value: 'preinfusionTime',
                },
                {
                    text: 'Total time',
                    value: 'totalTime',
                },
                {
                    text: 'Actions',
                    value: 'actions',
                    sortable: false,
                },
            ],
        },
        methods: {
            buttonFunction() {
                if (this.interval || this.voiceDetector) {
                    return this.stopTimer();
                }
                else if (this.hasTimed) {
                    return this.resetFunction();
                }
                return this.startTimer();
            },
            resetFunction() {
                this.stopTimer();
                this.hasTimed = false;

                this.extraTotalTime = 0;
                if (this.initialPreinfusionTimer) {
                    this.preinfusionTimer = this.initialPreinfusionTimer;
                }
                if (this.initialTotalTimer) {
                    this.totalTimer = this.initialTotalTimer;
                }
            },
            saveFunction() {
                this.history.push({
                    grindLevel: this.grindLevel,
                    preinfusionTime: this.initialPreinfusionTimer - this.preinfusionTimer,
                    totalTime: this.initialTotalTimer - this.totalTimer + this.extraTotalTime,
                });
                this.storeValue('history');
                this.resetFunction();
            },
            noAudio() {
                this.shouldUseAudio = false;
                this.dialogAudio = false;
                this.startTimer();
            },
            useAudio() {
                this.shouldUseAudio = true;
                this.dialogAudio = false;
                this.startTimer();
            },
            startTimer() {
                let doTimer = () => {
                    this.hasTimed = true;

                    this.initialPreinfusionTimer = this.preinfusionTimer;
                    this.initialTotalTimer = this.totalTimer;

                    this.interval = window.setInterval(() => {
                        if (this.preinfusionTimer > 0) {
                            this.preinfusionTimer -= 1;
                        }

                        let previousTotalTimer = this.totalTimer;
                        if (this.totalTimer > 0) {
                            this.totalTimer -= 1;
                        } else {
                            this.extraTotalTime += 1;
                        }

                        if (previousTotalTimer > 0 && this.totalTimer == 0) {
                            this.audioEnd.play();
                        } else {
                            this.audioTick.play();
                        }
                    }, ONE_SECOND);
                };

                if (this.shouldUseAudio) {
                    console.log('Starting timer with voice detection.')

                    var handleSuccess = (stream) => {
                        var options = {
                            onUpdate: (val) => {
                                if (
                                    val > AUDIO_THRESHOLD
                                    && (new Date()) - this.voiceActivityStartDate > ONE_SECOND
                                ) {
                                    this.voiceActivityStartDate = new Date();
                                    if (this.hasTimed) {
                                        console.log(`Stopping timer due to voice (value: ${val}).`)
                                        this.stopTimer();
                                    } else {
                                        console.log(`Starting timer due to voice (value: ${val}).`)
                                        doTimer();
                                    }
                                }
                            }
                        };
                        this.voiceDetector = vad(audioContext, stream, options);
                    };
                    requestMic(
                        handleSuccess,
                        () => window.alert('Unable to access microphone...')
                    );
                } else {
                    console.log('Starting timer directly.')
                    doTimer();
                }
            },
            stopTimer() {
                console.log('Timer stopped.')
                if (this.interval) {
                    window.clearInterval(this.interval);
                }
                if (this.voiceDetector) {
                    this.voiceDetector.destroy();
                    this.voiceDetector = null;
                }
                this.interval = null;
            },
            deleteItem(item) {
                this.deletedIndex = this.history.indexOf(item);
                this.dialogDelete = true;
            },
            closeDelete() {
                this.dialogDelete = false;
                this.$nextTick(() => {
                    this.deletedIndex = -1;
                })
            },
            deleteItemConfirm () {
                this.history.splice(this.deletedIndex, 1);
                this.storeValue('history');
                this.closeDelete();
            },
            storeValue(item) {
                window.localStorage.setItem(item, JSON.stringify(this[item]));
            },
        },
    });
})();
