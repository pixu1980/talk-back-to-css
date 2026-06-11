/* JS *NOT NEEDED* for Chrome, only for Safari/Firefox */
/* Uses the enhanced attr()-method in CSS */

const NUMERIC_ATTRIBUTES = new Set([
	"depth",
	"speed",
	"trails",
	"energy",
	"voltage",
	"minute",
	"power",
	"destinationYear",
	"instability",
	"erasure",
	"load",
]);

const LIVE_VALUE_SELECTOR = "[data-live-value-target]";
const CONTROL_SELECTOR = "[data-attr-slider-target], [data-attr-field-target]";
const FLUX_CAPACITOR_SELECTOR = "flux-capacitor[data-speed]";
const FLUX_RESET_STEP_MS = 20;
const fluxTravelTimers = new WeakMap();
const fluxResetTimers = new WeakMap();

const toKebab = (value) =>
	value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

function isAdvancedAttrSupported() {
	const testElement = document.createElement("div");
	(document.body ?? document.documentElement).appendChild(testElement);

	try {
		testElement.style.setProperty("--t", "attr(data-test type(<number>), 0)");
		testElement.dataset.test = "123";

		const computedValue = getComputedStyle(testElement)
			.getPropertyValue("--t")
			.trim();

		return computedValue === "123";
	} catch {
		return false;
	} finally {
		testElement.remove();
	}
}

const ADVANCED_ATTR_SUPPORTED = isAdvancedAttrSupported();

function parseCssTime(value) {
	const trimmedValue = value.trim();
	const numericValue = Number.parseFloat(trimmedValue);

	if (!Number.isFinite(numericValue)) {
		return 0;
	}

	return trimmedValue.endsWith("ms") ? numericValue : numericValue * 1000;
}

function formatValue(value, format) {
	switch (format) {
		case "mph":
			return `${value} mph`;
		case "gw":
			return `${value} GW`;
		case "percent":
			return `${value}%`;
		case "year":
			return `${value}`;
		default:
			return value;
	}
}

function selectorTargetsElement(selector, element) {
	try {
		return document.querySelector(selector) === element;
	} catch {
		return false;
	}
}

function hydrateElement(element) {
	for (const [key, value] of Object.entries(element.dataset)) {
		const name = toKebab(key);
		const parsed = NUMERIC_ATTRIBUTES.has(key) ? Number(value) : value;
		element.style.setProperty(
			`--data-${name}`,
			Number.isFinite(parsed) ? parsed : value,
		);
	}
}

function hydrateAll() {
	document.querySelectorAll("*").forEach((element) => {
		if (Object.keys(element.dataset).length) {
			hydrateElement(element);
		}
	});
}

function syncAttributeBindings(element, attrName, value) {
	document.querySelectorAll(CONTROL_SELECTOR).forEach((control) => {
		const targetSelector =
			control.dataset.attrSliderTarget ?? control.dataset.attrFieldTarget;

		if (
			control.dataset.attrName !== attrName ||
			!selectorTargetsElement(targetSelector, element)
		) {
			return;
		}

		control.value = value;

		if (control.dataset.attrStyleVar) {
			element.style.setProperty(control.dataset.attrStyleVar, value);
		}
	});

	document.querySelectorAll(LIVE_VALUE_SELECTOR).forEach((output) => {
		if (
			output.dataset.liveValue !== attrName ||
			!selectorTargetsElement(output.dataset.liveValueTarget, element)
		) {
			return;
		}

		output.textContent = formatValue(value, output.dataset.liveFormat);
	});
}

function setHydratedAttribute(element, attrName, value) {
	const nextValue = String(value);
	element.setAttribute(attrName, nextValue);
	hydrateElement(element);
	syncAttributeBindings(element, attrName, nextValue);
}

function getFluxTravelTime(element) {
	const styles = getComputedStyle(element);
	const duration = parseCssTime(
		styles.getPropertyValue("--flux-capacitor--travel-duration"),
	);
	const delay = parseCssTime(
		styles.getPropertyValue("--flux-capacitor--travel-delay"),
	);

	return duration + delay;
}

function clearFluxTravelTimer(element) {
	const timer = fluxTravelTimers.get(element);

	if (!timer) {
		return;
	}

	clearTimeout(timer);
	fluxTravelTimers.delete(element);
}

function stopFluxReset(element) {
	const timer = fluxResetTimers.get(element);

	if (!timer) {
		return;
	}

	clearInterval(timer);
	fluxResetTimers.delete(element);
}

function startFluxReset(element) {
	clearFluxTravelTimer(element);

	if (fluxResetTimers.has(element)) {
		return;
	}

	let speed = Number(element.dataset.speed) || 88;
	const timer = setInterval(() => {
		speed = Math.max(0, speed - 1);
		setHydratedAttribute(element, "data-speed", speed);

		if (speed === 0) {
			stopFluxReset(element);
		}
	}, FLUX_RESET_STEP_MS);

	fluxResetTimers.set(element, timer);
}

function scheduleFluxReset(element) {
	if (fluxTravelTimers.has(element) || fluxResetTimers.has(element)) {
		return;
	}

	const fallbackDelay = getFluxTravelTime(element) + 80;
	const timer = setTimeout(() => startFluxReset(element), fallbackDelay);
	fluxTravelTimers.set(element, timer);
}

function handleFluxSpeed(element) {
	const speed = Number(element.dataset.speed);

	if (speed >= 88) {
		scheduleFluxReset(element);
		return;
	}

	if (!fluxResetTimers.has(element)) {
		clearFluxTravelTimer(element);
	}
}

function hydrateFretBoards() {
	if (ADVANCED_ATTR_SUPPORTED) {
		return;
	}

	document.querySelectorAll("fret-board").forEach((fretBoard) => {
		fretBoard.style.setProperty(
			"--fb--strings",
			fretBoard.getAttribute("strings"),
		);
		fretBoard.style.setProperty("--fb--frets", fretBoard.getAttribute("frets"));

		fretBoard.querySelectorAll("string-note").forEach((note) => {
			note.style.setProperty("--string", note.getAttribute("string") || 1);
			note.style.setProperty("--fret", note.getAttribute("fret") || 0);
			note.style.setProperty("--barre", note.getAttribute("barre") || 1);
		});
	});
}

function observeAttributeHydration() {
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			if (
				record.type !== "attributes" ||
				!record.attributeName?.startsWith("data-") ||
				!(record.target instanceof HTMLElement)
			) {
				continue;
			}

			hydrateElement(record.target);
			syncAttributeBindings(
				record.target,
				record.attributeName,
				record.target.getAttribute(record.attributeName) ?? "",
			);

			if (
				record.attributeName === "data-speed" &&
				record.target.matches(FLUX_CAPACITOR_SELECTOR)
			) {
				handleFluxSpeed(record.target);
			}
		}
	});

	observer.observe(document.documentElement, {
		attributes: true,
		subtree: true,
	});
}

function initTimeCircuitsToggle() {
	document.addEventListener("click", (event) => {
		const button = event.target.closest(
			"[is='time-circuits'] button[type='button']",
		);

		if (!button) {
			return;
		}

		const form = button.closest("[is='time-circuits']");
		const isLocked = form.dataset.locked === "true";
		form.dataset.locked = String(!isLocked);
		form.dataset.valid = String(isLocked);
		button.textContent = isLocked ? "Timeline unlocked" : "Unlock timeline";
		hydrateAll();
	});
}

function initJohnnyChordCycling() {
	const chordCycle = ["A7", "D7", "E7"];

	setInterval(() => {
		const chords = [
			...document.querySelectorAll("[is='johnny-chords'] .chord"),
		];

		if (!chords.length) {
			return;
		}

		const index = chords.findIndex((chord) =>
			chord.classList.contains("active"),
		);
		chords.forEach((chord) => chord.classList.remove("active"));
		chords[(index + 1) % chordCycle.length]?.classList.add("active");
	}, 900);
}

function initFluxReset() {
	document.addEventListener("animationend", (event) => {
		if (event.animationName !== "flux-capacitor-light-1") {
			return;
		}

		const capacitor = event.target.closest(FLUX_CAPACITOR_SELECTOR);

		if (capacitor && Number(capacitor.dataset.speed) >= 88) {
			startFluxReset(capacitor);
		}
	});

	document.querySelectorAll(FLUX_CAPACITOR_SELECTOR).forEach(handleFluxSpeed);
}

function initCssAttrFallbacks() {
	hydrateFretBoards();
	hydrateAll();
	observeAttributeHydration();
	initTimeCircuitsToggle();
	initJohnnyChordCycling();
	initFluxReset();

	window.backToCssHydrateAttributes = hydrateAll;
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initCssAttrFallbacks);
} else {
	initCssAttrFallbacks();
}
