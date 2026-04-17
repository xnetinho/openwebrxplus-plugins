---
layout: page
title: "OpenWebRX+ Receiver Plugin: TETRA"
permalink: /receiver/tetra
---

This `receiver` plugin displays **TETRA** (Terrestrial Trunked Radio) signaling metadata in a panel styled like the DMR panel, showing 4 TDMA timeslots with caller identity, group address, call type, and encryption status.

Requires the [xnetinho/openwebrxplus-tetra](https://github.com/xnetinho/openwebrxplus-docker-builder) Docker image for the backend TETRA decoder.

## Preview

![tetra panel](tetra/tetra.png "TETRA Panel Preview")

## Features

- **Network info**: MCC/MNC, downlink/uplink frequencies, color code, encryption status
- **Signal quality**: AFC offset, burst rate
- **4 TDMA timeslots**: per-slot caller identity (ISSI), group address (GSSI), call type (group / individual / emergency)
- Visual style mirrors the DMR panel: color-coded border per call type, user icon, dimmed slots when idle

## Requirements

- OpenWebRX+ with the `xnetinho/openwebrxplus-tetra` Docker image  
  (provides the backend `tetra_decoder.py` pipeline and patches to `modes.py`, `feature.py`, `dsp.py`)
- `utils >= 0.1`

## Load

Add this line in your `init.js` file:

```js
await Plugins.load('https://0xaf.github.io/openwebrxplus-plugins/receiver/tetra/tetra.js');
```

If using the xnetinho fork directly:

```js
await Plugins.load('https://xnetinho.github.io/openwebrxplus-docker-builder/plugins/receiver/tetra/tetra.js');
```

## init.js

Learn how to [load plugins](/openwebrxplus-plugins/#load-plugins).

## Code

[Github repo](https://github.com/0xAF/openwebrxplus-plugins/tree/main/receiver/tetra)
