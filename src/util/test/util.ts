import {Map} from '../../ui/map';
import {extend} from '../../util/util';
import {Dispatcher} from '../../util/dispatcher';
import {setWebGlContext} from './mock_webgl';
import {IActor} from '../actor';
import type {Evented} from '../evented';

export function createMap(options?, callback?) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        maplibreLogo: false,
        trackResize: true,
        style: {
            'version': 8,
            'sources': {},
            'layers': []
        }
    };

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

    if (options && options.deleteStyle) delete defaultOptions.style;

    const map = new Map(extend(defaultOptions, options));
    if (callback) map.on('load', () => {
        callback(null, map);
    });

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return test.equal(expectedRounded, actualRounded, message, extra);
}

// mock failed webgl context by dispatching "webglcontextcreationerror" event
// and returning null
export function setErrorWebGlContext() {
    const originalGetContext = global.HTMLCanvasElement.prototype.getContext;

    function imitateErrorWebGlGetContext(type, attributes) {
        if (type === 'webgl2' || type === 'webgl') {
            const errorEvent = new Event('webglcontextcreationerror');
            (errorEvent as any).statusMessage = 'mocked webglcontextcreationerror message';
            this.dispatchEvent(errorEvent);
            return null;
        }
        // Fallback to existing HTMLCanvasElement getContext behaviour
        return originalGetContext.call(this, type, attributes);
    }
    global.HTMLCanvasElement.prototype.getContext = imitateErrorWebGlGetContext;
}

export function setPerformance() {
    window.performance.mark = jest.fn();
    window.performance.clearMeasures = jest.fn();
    window.performance.clearMarks = jest.fn();
}

export function setMatchMedia() {
    // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(), // deprecated
            removeListener: jest.fn(), // deprecated
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
}

function setResizeObserver() {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
    }));
}

export function beforeMapTest() {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
    setResizeObserver();
}

export function getWrapDispatcher() {
    const wrapDispatcher = (actor: IActor) => {
        return {
            getActor() {
                return actor;
            }
        } as any as Dispatcher;
    };

    return wrapDispatcher;
}

export function getMockDispatcher() {
    const wrapDispatcher = getWrapDispatcher();

    const mockDispatcher = wrapDispatcher({
        sendAsync() { return Promise.resolve({}); },
    });

    return mockDispatcher;
}

export function stubAjaxGetImage(createImageBitmap) {
    global.createImageBitmap = createImageBitmap;

    global.URL.revokeObjectURL = () => {};
    global.URL.createObjectURL = (_) => { return null; };

    // eslint-disable-next-line accessor-pairs
    Object.defineProperty(global.Image.prototype, 'src', {
        set(url: string) {
            if (url === 'error') {
                this.onerror();
            } else if (this.onload) {
                this.onload();
            }
        }
    });
}

/**
 * This should be used in test that use nise since the internal buffer returned from a file is not an instance of ArrayBuffer for some reason.
 * @param data - the data read from a file, for example by `fs.readFileSync(...)`
 * @returns a copy of the data in the file in `ArrayBuffer` format
 */
export function bufferToArrayBuffer(data: Buffer): ArrayBuffer {
    const newBuffer = new ArrayBuffer(data.buffer.byteLength);
    const view = new Uint8Array(newBuffer);
    data.copy(view);
    return view.buffer;
}

/**
 * This allows test to wait for a certain amount of time before continuing.
 * @param milliseconds - the amount of time to wait in milliseconds
 * @returns - a promise that resolves after the specified amount of time
 */
export const sleep = (milliseconds: number = 0) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

export function waitForMetadataEvent(source: Evented): Promise<void> {
    return new Promise((resolve) => {
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                resolve();
            }
        });
    });
}
