/*
 * tetra Receiver Plugin for OpenWebRX+ — v1.5
 *
 * Displays TETRA (Terrestrial Trunked Radio) signaling metadata:
 * network info, encryption mode (TEA1/2/3), 4 TDMA timeslots,
 * status and SDS messages.
 *
 * v1.5 fix: timeslot indicators now reflect data.timeslots dict
 * emitted by the backend (was reading non-existent data.slot which
 * defaulted to 0 → only TS1 ever lit). Call data is routed to the
 * timeslot(s) currently flagged 'assigned' in the most recent burst
 * event. Slot field mapping aligned with backend payload (data.ssi
 * is GSSI, data.ssi2 is ISSI, matching TETMON convention used by
 * upstream osmo-tetra-sq5bpf).
 *
 * Encryption semantics (v1.3+):
 *   - Cell security class (TEA capability advertised by the BS) is shown
 *     as an amber informational badge when no call is active.
 *   - Active call encryption (from per-call ENCR field) is shown
 *     in red when a call is actually encrypted.
 *   - A clear call on a TEA-capable cell shows green 'Clear (SC TEAn)'.
 *
 * Requires the xnetinho/openwebrxplus-tetra Docker image (backend decoder).
 *
 * License: MIT
 * Copyright (c) 2026 xnetinho
 */

Plugins.tetra = Plugins.tetra || {};
Plugins.tetra._version = 1.5;

Plugins.tetra.networkNames = {};

Plugins.tetra.init = function () {
	if (!Plugins.isLoaded('utils', 0.1)) {
		console.error('[tetra] plugin requires "utils >= 0.1".');
		return false;
	}
	Plugins.utils.on_ready(function () {
		Plugins.tetra._injectPanel();
		Plugins.tetra._registerMetaPanel();
	});
	return true;
};

// ── Panel HTML injection ──────────────────────────────────────────────────────────────

Plugins.tetra._injectPanel = function () {
	if (document.getElementById('openwebrx-panel-metadata-tetra')) return;

	var slots = '';
	for (var i = 1; i <= 4; i++) {
		slots +=
			'<div class="openwebrx-tetra-slot" id="tetra-slot-' + i + '">' +
				'<div class="tetra-slot-left">' +
					'<span class="tetra-slot-number">TS ' + i + '</span>' +
					'<div class="openwebrx-meta-user-image">' +
						'<img class="directcall" src="static/gfx/openwebrx-directcall.svg">' +
						'<img class="groupcall"  src="static/gfx/openwebrx-groupcall.svg">' +
					'</div>' +
				'</div>' +
				'<div class="tetra-slot-body">' +
					'<div class="tetra-slot-row">' +
						'<span class="tetra-slot-key">ISSI</span>' +
						'<span class="tetra-slot-val tetra-issi" id="tetra-s' + i + '-issi">---</span>' +
					'</div>' +
					'<div class="tetra-slot-row">' +
						'<span class="tetra-slot-key">GSSI</span>' +
						'<span class="tetra-slot-val tetra-gssi" id="tetra-s' + i + '-gssi">---</span>' +
					'</div>' +
					'<div class="tetra-slot-row">' +
						'<span class="tetra-slot-key">Type</span>' +
						'<span class="tetra-slot-val tetra-calltype" id="tetra-s' + i + '-type">---</span>' +
					'</div>' +
				'</div>' +
			'</div>';
	}

	var html =
		'<div class="openwebrx-panel openwebrx-meta-panel tetra-panel" ' +
			'id="openwebrx-panel-metadata-tetra" ' +
			'style="display:none" ' +
			'data-panel-name="metadata-tetra">' +

			'<div class="tetra-section tetra-col-network">' +
				'<div class="tetra-section-title">Network</div>' +
				'<div class="tetra-grid">' +
					'<span class="tetra-key">Name</span>' +
					'<span class="tetra-val tetra-wide" id="tetra-netname">---</span>' +
					'<span class="tetra-key">MCC / MNC</span>' +
					'<span class="tetra-val" id="tetra-mcc-mnc">---</span>' +
					'<span class="tetra-key">LA</span>' +
					'<span class="tetra-val" id="tetra-la">---</span>' +
					'<span class="tetra-key">DL Freq</span>' +
					'<span class="tetra-val" id="tetra-dl">---</span>' +
					'<span class="tetra-key">UL Freq</span>' +
					'<span class="tetra-val" id="tetra-ul">---</span>' +
					'<span class="tetra-key">Color Code</span>' +
					'<span class="tetra-val" id="tetra-cc">---</span>' +
					'<span class="tetra-key">Encryption</span>' +
					'<span class="tetra-val tetra-enc" id="tetra-enc">---</span>' +
				'</div>' +
			'</div>' +

			'<div class="tetra-section tetra-col-signal">' +
				'<div class="tetra-section-title">Signal</div>' +
				'<div class="tetra-signal-grid">' +
					'<span class="tetra-key">AFC</span>' +
					'<span class="tetra-val" id="tetra-afc">---</span>' +
					'<span class="tetra-key">Bursts/s</span>' +
					'<span class="tetra-val" id="tetra-burst-rate">---</span>' +
				'</div>' +
				'<div id="tetra-status-block" style="display:none">' +
					'<div class="tetra-signal-separator"></div>' +
					'<div class="tetra-signal-subtitle">Status</div>' +
					'<div class="tetra-status-line" id="tetra-last-status">---</div>' +
				'</div>' +
				'<div id="tetra-sds-block" style="display:none">' +
					'<div class="tetra-signal-separator"></div>' +
					'<div class="tetra-signal-subtitle">SDS</div>' +
					'<div class="tetra-sds-line" id="tetra-last-sds">---</div>' +
				'</div>' +
			'</div>' +

			'<div class="tetra-section tetra-col-timeslots">' +
				'<div class="tetra-section-title">Timeslots</div>' +
				slots +
			'</div>' +
		'</div>';

	var dmr = document.getElementById('openwebrx-panel-metadata-dmr');
	if (dmr && dmr.parentNode) {
		dmr.insertAdjacentHTML('afterend', html);
	} else {
		var existing = document.querySelector('.openwebrx-meta-panel');
		if (existing && existing.parentNode) {
			existing.parentNode.insertAdjacentHTML('beforeend', html);
		} else {
			document.body.insertAdjacentHTML('beforeend', html);
		}
	}

	var panelEl = document.getElementById('openwebrx-panel-metadata-tetra');
	if (panelEl) {
		panelEl.addEventListener('transitionend', function(ev) {
			if (ev.target !== this) return;
			this.style.transitionDuration = null;
			this.style.transitionProperty = null;
			if (this.movement && this.movement === 'collapse') {
				this.style.display = 'none';
			}
			delete this.movement;
		});
	}

	Plugins.tetra._clearPanel = function() {
		try {
			var panel = $('#openwebrx-panel-metadata-tetra');
			var instance = panel.data('metapanel');
			if (instance && typeof instance.clear === 'function') {
				instance.clear();
			}
		} catch (e) {}
	};

	if (!Plugins.tetra._isUiHooked) {
		Plugins.utils.wrap_func('setFrequency', function() {
			Plugins.tetra._clearPanel();
			return true;
		}, null, UI);
		Plugins.utils.wrap_func('setOffsetFrequency', function() {
			Plugins.tetra._clearPanel();
			return true;
		}, null, UI);
		if (typeof Demodulator !== 'undefined' && Demodulator.prototype) {
			Plugins.utils.wrap_func('set_offset_frequency', function() {
				Plugins.tetra._clearPanel();
				return true;
			}, null, Demodulator.prototype);
		}
		Plugins.tetra._isUiHooked = true;
	}
};

// ── MetaPanel subclass ──────────────────────────────────────────────────────────────────

Plugins.tetra._registerMetaPanel = function () {

	function TetraMetaSlot(el) {
		this.el = $(el);
		this.idx = parseInt(this.el.attr('id').replace('tetra-slot-', ''), 10);
	}

	TetraMetaSlot.prototype.update = function (data) {
		var callType = (data.call_type || 'group').toLowerCase();
		this.el.addClass('active').removeClass('groupcall directcall emergency');
		if (callType.indexOf('individual') >= 0 || callType.indexOf('direct') >= 0) {
			this.el.addClass('directcall');
		} else if (callType.indexOf('emergency') >= 0) {
			this.el.addClass('emergency');
		} else {
			this.el.addClass('groupcall');
		}
		if (data.encrypted) {
			this.el.addClass('encrypted');
		} else {
			this.el.removeClass('encrypted');
		}
		// Backend uses TETMON convention: ssi = address from MAC RESOURCE
		// (= GSSI for group calls), ssi2 = ISSI of subscriber when present.
		this._set('issi', data.ssi2 || data.issi || '---');
		this._set('gssi', data.ssi  || data.gssi || '---');
		this._set('type', callType || '---');
	};

	TetraMetaSlot.prototype.setBusy = function () {
		// Mark slot as carrying traffic (from burst.timeslots = "assigned")
		// without overwriting any existing call data.
		this.el.addClass('active');
	};

	TetraMetaSlot.prototype.setIdle = function () {
		// Mark slot as not carrying traffic right now. Keep the most recent
		// call data visible (it may be a brief gap inside an ongoing call).
		this.el.removeClass('active');
	};

	TetraMetaSlot.prototype.clear = function () {
		this.el.removeClass('active groupcall directcall emergency encrypted');
		this._set('issi', '---');
		this._set('gssi', '---');
		this._set('type', '---');
	};

	TetraMetaSlot.prototype._set = function (field, value) {
		$('#tetra-s' + this.idx + '-' + field).text(value);
	};

	function TetraMetaPanel($el) {
		MetaPanel.call(this, $el);
		this.modes = ['TETRA'];
		this.slots = this.el.find('.openwebrx-tetra-slot').toArray().map(function (el) {
			return new TetraMetaSlot(el);
		});
		// Tracks cell-level TEA advertisement (from NETINFO1/ENCINFO1)
		this._cellTea = 'none';
		this._cellSc  = 0;
		// Most recent burst.timeslots dict, used to route incoming call_*
		// events to the actually-assigned slots (the backend doesn't tag
		// each call with a TN, so we correlate via the last burst).
		this._lastTimeslots = {};
	}

	TetraMetaPanel.prototype = Object.create(MetaPanel.prototype);
	TetraMetaPanel.prototype.constructor = TetraMetaPanel;

	TetraMetaPanel.prototype._assignedSlots = function () {
		var tns = [];
		for (var k in this._lastTimeslots) {
			if (this._lastTimeslots[k] === 'assigned') {
				var idx = parseInt(k, 10);
				if (idx >= 1 && idx <= 4) tns.push(idx);
			}
		}
		return tns;
	};

	TetraMetaPanel.prototype.update = function (data) {
		if (!this.isSupported(data)) return;
		var type = data.type;

		if (type === 'netinfo') {
			var mcc = data.mcc || '?';
			var mnc = data.mnc || '?';
			var netKey = mcc + '-' + mnc;
			var netName = Plugins.tetra.networkNames[netKey] || '---';
			$('#tetra-netname').text(netName);
			$('#tetra-mcc-mnc').text(mcc + ' / ' + mnc);
			$('#tetra-la').text(data.la || '---');
			$('#tetra-dl').text(Plugins.tetra._formatFreq(data.dl_freq));
			$('#tetra-ul').text(Plugins.tetra._formatFreq(data.ul_freq));
			$('#tetra-cc').text(data.color_code !== undefined && data.color_code !== '' ? data.color_code : '---');
			this._cellSc  = data.cell_security_class || 0;
			this._cellTea = data.cell_tea || 'none';
			Plugins.tetra._setEnc(false, 'none', this._cellTea);

		} else if (type === 'freqinfo') {
			$('#tetra-dl').text(Plugins.tetra._formatFreq(data.dl_freq));
			$('#tetra-ul').text(Plugins.tetra._formatFreq(data.ul_freq));

		} else if (type === 'encinfo') {
			this._cellSc  = data.cell_security_class || this._cellSc;
			this._cellTea = data.cell_tea || this._cellTea;
			Plugins.tetra._setEnc(false, 'none', this._cellTea);

		} else if (type === 'burst') {
			$('#tetra-afc').text(data.afc !== undefined ? data.afc : '---');
			$('#tetra-burst-rate').text(data.burst_rate || '---');

			// Bug-fix v1.5: backend emits `data.timeslots` as a dict
			// {"1":"assigned","2":"unallocated",...}. Old code read
			// `data.slot` which never existed and always defaulted to 0,
			// so only TS1 ever lit. Iterate the dict and toggle the
			// busy/idle ('active') class per slot.
			if (data.timeslots) {
				this._lastTimeslots = data.timeslots;
				for (var tn in data.timeslots) {
					var idx = parseInt(tn, 10);
					if (idx < 1 || idx > 4) continue;
					var slot = this.slots[idx - 1];
					var usage = data.timeslots[tn];
					if (usage === 'assigned') {
						slot.setBusy();
					} else if (usage === 'unallocated') {
						slot.setIdle();
					}
				}
			}

		} else if (type === 'call_setup' || type === 'call_connect' || type === 'tx_grant') {
			// Bug-fix v1.5: backend doesn't tag calls with TN. Route the
			// call to whichever slot(s) are currently flagged 'assigned'
			// in the latest burst. Fallback to TS1 if none seen yet.
			var targets = this._assignedSlots();
			if (targets.length === 0) targets = [1];
			for (var t = 0; t < targets.length; t++) {
				this.slots[targets[t] - 1].update(data);
			}
			Plugins.tetra._setEnc(!!data.encrypted, data.encryption_type || 'none', this._cellTea);

		} else if (type === 'call_release') {
			for (var i = 0; i < this.slots.length; i++) {
				this.slots[i].clear();
			}
			Plugins.tetra._setEnc(false, 'none', this._cellTea);

		} else if (type === 'status') {
			var stxt = (data.ssi || '?') + ' → ' + (data.ssi2 || '?') + '  Status ' + (data.status || '?');
			$('#tetra-last-status').text(stxt);
			$('#tetra-status-block').show();

		} else if (type === 'sds') {
			var from = data.ssi || data.from || '?';
			var to   = data.ssi2 || data.to || '?';
			var sdstxt = from + ' → ' + to + ': ' + (data.text || '');
			$('#tetra-last-sds').text(sdstxt);
			$('#tetra-sds-block').show();
		}
	};

	TetraMetaPanel.prototype.clear = function () {
		MetaPanel.prototype.clear.call(this);
		$('#tetra-netname').text('---');
		$('#tetra-mcc-mnc').text('---');
		$('#tetra-la').text('---');
		$('#tetra-dl').text('---');
		$('#tetra-ul').text('---');
		$('#tetra-cc').text('---');
		$('#tetra-enc').text('---').removeClass('enc-yes enc-no enc-tea enc-cell');
		$('#tetra-afc').text('---');
		$('#tetra-burst-rate').text('---');
		$('#tetra-last-status').text('---');
		$('#tetra-status-block').hide();
		$('#tetra-last-sds').text('---');
		$('#tetra-sds-block').hide();
		this._cellTea = 'none';
		this._cellSc  = 0;
		this._lastTimeslots = {};
		for (var i = 0; i < this.slots.length; i++) {
			this.slots[i].clear();
		}
	};

	MetaPanel.types['tetra'] = TetraMetaPanel;

	var $panel = $('#openwebrx-panel-metadata-tetra');
	if ($panel.length && !$panel.data('metapanel')) {
		$panel.metaPanel();
	}
};

// ── Helpers ──────────────────────────────────────────────────────────────────────────

Plugins.tetra._formatFreq = function (hz) {
	if (!hz) return '---';
	var n = parseFloat(hz);
	if (isNaN(n) || n === 0) return '---';
	return (n / 1e6).toFixed(4) + ' MHz';
};

/**
 * Update the encryption badge.
 *
 * @param {boolean} encrypted  - true when the active call is encrypted
 * @param {string}  encType    - active call encryption type: 'TEA1' / 'TEA2' /
 *                               'TEA3' / 'none'
 * @param {string}  cellTea    - cell-level TEA capability advertised in
 *                               NETINFO1/ENCINFO1: 'TEA1' / 'TEA2' / 'TEA3' /
 *                               'none'. Used to show an informational badge
 *                               when no call is actively encrypted.
 */
Plugins.tetra._setEnc = function (encrypted, encType, cellTea) {
	var $el = $('#tetra-enc');
	$el.removeClass('enc-yes enc-no enc-tea enc-cell');

	if (encrypted) {
		var label = (encType || '').toUpperCase();
		if (label.indexOf('TEA') === 0) {
			$el.text(label + ' (active)').addClass('enc-tea');
		} else {
			$el.text('ENC ' + (label || 'YES')).addClass('enc-yes');
		}
		return;
	}

	var ct = (cellTea || 'none').toUpperCase();
	if (ct !== 'NONE' && ct !== '') {
		$el.text('Clear (SC ' + ct + ')').addClass('enc-cell');
	} else {
		$el.text('Clear').addClass('enc-no');
	}
};
