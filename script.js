/*
    RBWR FACILITY ATLAS
    ===================

    Front-end prototype.

    Features:
    - Multiple floors
    - Rectangle locations
    - Polygon locations
    - Pan
    - Zoom
    - Room information
    - Editor mode
    - Import/export
    - Dark/light mode
    - Browser persistence

    IMPORTANT:
    The password below is represented by a SHA-256 hash rather
    than being stored as plain text.

    This is suitable for a simple prototype, but it is NOT
    proper server-side authentication.

    For the final public version, authentication should be
    moved server-side.
*/


/* =========================================================
   CONFIGURATION
========================================================= */

const CONFIG = {

    /*
        This is the SHA-256 hash of the editor password.

        DEFAULT PASSWORD:

        rbwr

        CHANGE THIS before publishing.

        You can generate a new hash using the browser console
        with:

        crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode("YOUR PASSWORD")
        )

        The conversion helper at the bottom of this file can
        also be used.
    */

    passwordHash:
        "2f6f9d0a2e4e8c4f0a0b7f6a6e1f6d4f7e0f3a5b4d8f9c2a1e6d5b3c7f8a9e0d",

    storageKey:
        "rbwr_facility_atlas",

    themeKey:
        "rbwr_facility_atlas_theme"
};


/* =========================================================
   STATE
========================================================= */

let state = {

    floors: [
        {
            id: "floor_1",
            name: "Surface",
            locations: []
        }
    ],

    currentFloorId: "floor_1",

    selectedLocationId: null,

    editorMode: false,

    drawingMode: "select",

    drawingPoints: [],

    nextLocationId: 1,

    nextFloorId: 2
};


/* =========================================================
   MAP VIEW
========================================================= */

let view = {

    x: 0,
    y: 0,

    zoom: 1,

    dragging: false,

    dragStartX: 0,
    dragStartY: 0,

    originalX: 0,
    originalY: 0
};


/* =========================================================
   DOM
========================================================= */

const mapViewport =
    document.getElementById("mapViewport");

const mapCanvas =
    document.getElementById("mapCanvas");

const mapSvg =
    document.getElementById("mapSvg");

const floorSelector =
    document.getElementById("floorSelector");

const infoPanel =
    document.getElementById("infoPanel");

const editorToolbar =
    document.getElementById("editorToolbar");

const passwordModal =
    document.getElementById("passwordModal");

const passwordInput =
    document.getElementById("passwordInput");

const passwordError =
    document.getElementById("passwordError");

const floorModal =
    document.getElementById("floorModal");

const floorNameInput =
    document.getElementById("floorNameInput");

const importFile =
    document.getElementById("importFile");


/* =========================================================
   INITIALISATION
========================================================= */

loadState();

loadTheme();

renderFloors();

renderMap();

updateEditorUI();

updateView();


/* =========================================================
   STORAGE
========================================================= */

function saveState() {

    /*
        Don't store temporary editor state.
    */

    const saveData = {

        floors: state.floors,

        currentFloorId:
            state.currentFloorId,

        nextLocationId:
            state.nextLocationId,

        nextFloorId:
            state.nextFloorId
    };

    localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify(saveData)
    );
}


function loadState() {

    const saved =
        localStorage.getItem(CONFIG.storageKey);

    if (!saved) {
        return;
    }

    try {

        const parsed =
            JSON.parse(saved);

        state.floors =
            parsed.floors || state.floors;

        state.currentFloorId =
            parsed.currentFloorId ||
            state.currentFloorId;

        state.nextLocationId =
            parsed.nextLocationId ||
            state.nextLocationId;

        state.nextFloorId =
            parsed.nextFloorId ||
            state.nextFloorId;

    } catch (error) {

        console.error(
            "Could not load saved map:",
            error
        );

    }
}


/* =========================================================
   FLOORS
========================================================= */

function getCurrentFloor() {

    return state.floors.find(
        floor =>
            floor.id === state.currentFloorId
    );
}


function renderFloors() {

    floorSelector.innerHTML = "";

    state.floors.forEach(floor => {

        const option =
            document.createElement("option");

        option.value = floor.id;

        option.textContent =
            floor.name;

        if (
            floor.id ===
            state.currentFloorId
        ) {

            option.selected = true;
        }

        floorSelector.appendChild(option);

    });
}


floorSelector.addEventListener(
    "change",
    () => {

        state.currentFloorId =
            floorSelector.value;

        state.selectedLocationId =
            null;

        renderMap();

        renderEmptyPanel();

        saveState();
    }
);


/* =========================================================
   FLOOR CREATION
========================================================= */

document
    .getElementById("addFloorButton")
    .addEventListener(
        "click",
        () => {

            if (!state.editorMode) {

                alert(
                    "Enter editor mode first."
                );

                return;
            }

            floorModal.classList.remove(
                "hidden"
            );

            floorNameInput.value = "";

            floorNameInput.focus();
        }
    );


document
    .getElementById("closeFloorModal")
    .addEventListener(
        "click",
        () => {

            floorModal.classList.add(
                "hidden"
            );
        }
    );


document
    .getElementById("createFloorButton")
    .addEventListener(
        "click",
        createFloor
    );


function createFloor() {

    const name =
        floorNameInput.value.trim();

    if (!name) {

        alert(
            "Please enter a floor name."
        );

        return;
    }

    const floor = {

        id:
            "floor_" +
            state.nextFloorId++,

        name,

        locations: []
    };

    state.floors.push(floor);

    state.currentFloorId =
        floor.id;

    floorModal.classList.add(
        "hidden"
    );

    renderFloors();

    renderMap();

    renderEmptyPanel();

    saveState();
}


/* =========================================================
   MAP RENDERING
========================================================= */

function renderMap() {

    mapSvg.innerHTML = "";

    const floor =
        getCurrentFloor();

    if (!floor) {
        return;
    }

    floor.locations.forEach(
        location => {

            drawLocation(location);

        }
    );

    drawTemporaryPolygon();

    updateSelectedLocation();
}


function drawLocation(location) {

    let element;

    if (location.shape === "rectangle") {

        element =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "rect"
            );

        element.setAttribute(
            "x",
            location.x
        );

        element.setAttribute(
            "y",
            location.y
        );

        element.setAttribute(
            "width",
            location.width
        );

        element.setAttribute(
            "height",
            location.height
        );

    }

    else {

        element =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "polygon"
            );

        element.setAttribute(
            "points",
            location.points
                .map(
                    point =>
                        `${point.x},${point.y}`
                )
                .join(" ")
        );

    }


    element.classList.add(
        "map-location"
    );

    if (
        state.selectedLocationId ===
        location.id
    ) {

        element.classList.add(
            "selected"
        );
    }


    element.setAttribute(
        "fill",
        location.color
    );

    element.setAttribute(
        "fill-opacity",
        "0.65"
    );

    element.setAttribute(
        "stroke",
        location.color
    );


    element.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            selectLocation(
                location.id
            );
        }
    );


    mapSvg.appendChild(element);


    /*
        Label
    */

    const center =
        getLocationCenter(location);

    const label =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
        );

    label.classList.add(
        "location-label"
    );

    label.setAttribute(
        "x",
        center.x
    );

    label.setAttribute(
        "y",
        center.y
    );

    label.setAttribute(
        "text-anchor",
        "middle"
    );

    label.setAttribute(
        "dominant-baseline",
        "middle"
    );

    label.textContent =
        location.name || "Unnamed";


    mapSvg.appendChild(label);


    /*
        Vertex handles for polygons
    */

    if (
        state.editorMode &&
        state.selectedLocationId ===
            location.id &&
        location.shape === "polygon"
    ) {

        drawPolygonHandles(
            location
        );
    }
}


/* =========================================================
   LOCATION CENTRE
========================================================= */

function getLocationCenter(location) {

    if (
        location.shape ===
        "rectangle"
    ) {

        return {

            x:
                location.x +
                location.width / 2,

            y:
                location.y +
                location.height / 2
        };
    }


    let x = 0;
    let y = 0;

    location.points.forEach(
        point => {

            x += point.x;
            y += point.y;

        }
    );

    return {

        x:
            x /
            location.points.length,

        y:
            y /
            location.points.length
    };
}


/* =========================================================
   SELECT LOCATION
========================================================= */

function selectLocation(id) {

    state.selectedLocationId =
        id;

    renderMap();

    renderInfoPanel();
}


function updateSelectedLocation() {

    /*
        Rendering is handled by renderMap().
    */

}


/* =========================================================
   EMPTY PANEL
========================================================= */

function renderEmptyPanel() {

    infoPanel.innerHTML = `

        <div class="panel-empty">

            <div class="panel-empty-icon">
                🗺️
            </div>

            <h2>Select a location</h2>

            <p>
                Click a room, corridor, hall or
                other location on the map.
            </p>

        </div>

    `;
}


/* =========================================================
   INFORMATION PANEL
========================================================= */

function renderInfoPanel() {

    const floor =
        getCurrentFloor();

    if (!floor) {
        return;
    }

    const location =
        floor.locations.find(
            item =>
                item.id ===
                state.selectedLocationId
        );

    if (!location) {

        renderEmptyPanel();

        return;
    }


    if (state.editorMode) {

        renderEditorPanel(location);

    } else {

        renderViewerPanel(location);

    }
}


/* =========================================================
   VIEWER PANEL
========================================================= */

function renderViewerPanel(location) {

    const screenshots =
        location.screenshots || [];

    const tags =
        location.tags || [];

    const equipment =
        location.equipment || [];

    const connections =
        location.connectedRooms || [];


    infoPanel.innerHTML = `

        <div class="panel-content">

            <div class="panel-header">

                <div>

                    <h1 class="panel-title">
                        ${escapeHTML(location.name)}
                    </h1>

                    <div class="panel-type">
                        ${escapeHTML(location.type)}
                    </div>

                </div>

            </div>


            <div class="section">

                <div class="section-title">
                    Floor
                </div>

                <div class="info-box">
                    ${escapeHTML(
                        getCurrentFloor().name
                    )}
                </div>

            </div>


            ${
                location.unit
                ? `
                    <div class="section">

                        <div class="section-title">
                            Unit
                        </div>

                        <div class="info-box">
                            ${escapeHTML(
                                location.unit
                            )}
                        </div>

                    </div>
                `
                : ""
            }


            ${
                location.shortDescription
                ? `
                    <div class="section">

                        <div class="section-title">
                            Overview
                        </div>

                        <div class="info-box">
                            ${escapeHTML(
                                location.shortDescription
                            )}
                        </div>

                    </div>
                `
                : ""
            }


            ${
                location.detailedDescription
                ? `
                    <div class="section">

                        <div class="section-title">
                            Description
                        </div>

                        <div class="info-box">
                            ${escapeHTML(
                                location.detailedDescription
                            )}
                        </div>

                    </div>
                `
                : ""
            }


            ${
                location.accessRequirements
                ? `
                    <div class="section">

                        <div class="section-title">
                            Access Requirements
                        </div>

                        <div class="info-box">
                            ${escapeHTML(
                                location.accessRequirements
                            )}
                        </div>

                    </div>
                `
                : ""
            }


            ${
                location.controlRequirements
                ? `
                    <div class="section">

                        <div class="section-title">
                            Required Equipment / Controls
                        </div>

                        <div class="info-box">
                            ${escapeHTML(
                                location.controlRequirements
                            )}
                        </div>

                    </div>
                `
                : ""
            }


            ${
                equipment.length
                ? `
                    <div class="section">

                        <div class="section-title">
                            Equipment
                        </div>

                        <ul class="info-list">

                            ${equipment
                                .map(
                                    item =>
                                        `<li>${escapeHTML(item)}</li>`
                                )
                                .join("")
                            }

                        </ul>

                    </div>
                `
                : ""
            }


            ${
                tags.length
                ? `
                    <div class="section">

                        <div class="section-title">
                            Tags
                        </div>

                        <div class="tag-container">

                            ${tags
                                .map(
                                    tag =>
                                        `<span class="tag">
                                            ${escapeHTML(tag)}
                                        </span>`
                                )
                                .join("")
                            }

                        </div>

                    </div>
                `
                : ""
            }


            ${
                location.fandomUrl
                ? `
                    <div class="section">

                        <div class="section-title">
                            Fandom
                        </div>

                        <a
                            class="link-button"
                            href="${escapeAttribute(
                                location.fandomUrl
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open Fandom page →
                        </a>

                    </div>
                `
                : ""
            }


            ${
                connections.length
                ? `
                    <div class="section">

                        <div class="section-title">
                            Connected Locations
                        </div>

                        <ul class="info-list">

                            ${connections
                                .map(
                                    item =>
                                        `<li>${escapeHTML(item)}</li>`
                                )
                                .join("")
                            }

                        </ul>

                    </div>
                `
                : ""
            }


            ${
                screenshots.length
                ? `
                    <div class="section">

                        <div class="section-title">
                            Screenshots
                        </div>

                        <div class="screenshot-grid">

                            ${screenshots
                                .map(
                                    image =>
                                        `
                                        <img
                                            class="screenshot"
                                            src="${image}"
                                            alt="${escapeAttribute(
                                                location.name
                                            )}"
                                            onclick="window.open(this.src, '_blank')"
                                        >
                                        `
                                )
                                .join("")
                            }

                        </div>

                    </div>
                `
                : ""
            }


            ${
                location.notes
                ? `
                    <div class="section">

                        <div class="section-title">
                            Notes
                        </div>

                        <div class="info-box">
                            ${escapeHTML(
                                location.notes
                            )}
                        </div>

                    </div>
                `
                : ""
            }

        </div>

    `;
}


/* =========================================================
   EDITOR PANEL
========================================================= */

function renderEditorPanel(location) {

    const floor =
        getCurrentFloor();


    infoPanel.innerHTML = `

        <div class="panel-content">

            <div class="panel-header">

                <div>

                    <h1 class="panel-title">
                        Edit Location
                    </h1>

                    <div class="panel-type">
                        ${escapeHTML(
                            location.type
                        )}
                    </div>

                </div>

            </div>


            <div class="form-group">

                <label>
                    Name
                </label>

                <input
                    id="editName"
                    value="${escapeAttribute(
                        location.name
                    )}"
                >

            </div>


            <div class="form-group">

                <label>
                    Type
                </label>

                <select id="editType">

                    ${[
                        "Room",
                        "Corridor",
                        "Hall",
                        "Other"
                    ]
                        .map(
                            type =>
                                `
                                <option
                                    ${
                                        location.type === type
                                        ? "selected"
                                        : ""
                                    }
                                >
                                    ${type}
                                </option>
                                `
                        )
                        .join("")
                    }

                </select>

            </div>


            <div
                id="customTypeContainer"
                class="form-group"
            >

                <label>
                    Other Type
                </label>

                <input
                    id="editCustomType"
                    value="${escapeAttribute(
                        location.customType || ""
                    )}"
                    placeholder="e.g. Stairwell"
                >

            </div>


            <div class="form-group">

                <label>
                    Unit
                </label>

                <input
                    id="editUnit"
                    value="${escapeAttribute(
                        location.unit || ""
                    )}"
                    placeholder="e.g. U1"
                >

            </div>


            <div class="form-group">

                <label>
                    Short Description
                </label>

                <textarea
                    id="editShortDescription"
                >${escapeHTML(
                    location.shortDescription || ""
                )}</textarea>

            </div>


            <div class="form-group">

                <label>
                    Detailed Description
                </label>

                <textarea
                    id="editDetailedDescription"
                >${escapeHTML(
                    location.detailedDescription || ""
                )}</textarea>

            </div>


            <div class="form-group">

                <label>
                    Access Requirements
                </label>

                <textarea
                    id="editAccess"
                >${escapeHTML(
                    location.accessRequirements || ""
                )}</textarea>

            </div>


            <div class="form-group">

                <label>
                    Required Equipment / Control Permissions
                </label>

                <textarea
                    id="editControls"
                >${escapeHTML(
                    location.controlRequirements || ""
                )}</textarea>

            </div>


            <div class="form-group">

                <label>
                    Equipment
                </label>

                <textarea
                    id="editEquipment"
                    placeholder="One item per line"
                >${escapeHTML(
                    (location.equipment || [])
                        .join("\n")
                )}</textarea>

            </div>


            <div class="form-group">

                <label>
                    Connected Locations
                </label>

                <textarea
                    id="editConnections"
                    placeholder="One location per line"
                >${escapeHTML(
                    (location.connectedRooms || [])
                        .join("\n")
                )}</textarea>

            </div>


            <div class="form-group">

                <label>
                    Tags
                </label>

                <input
                    id="editTags"
                    value="${escapeAttribute(
                        (location.tags || [])
                            .join(", ")
                    )}"
                    placeholder="reactor, restricted, control"
                >

            </div>


            <div class="form-group">

                <label>
                    Fandom URL
                </label>

                <input
                    id="editFandom"
                    value="${escapeAttribute(
                        location.fandomUrl || ""
                    )}"
                    placeholder="https://..."
                >

            </div>


            <div class="form-group">

                <label>
                    Location Colour
                </label>

                <input
                    id="editColor"
                    type="color"
                    value="${location.color}"
                >

            </div>


            <div class="form-group">

                <label>
                    Screenshots
                </label>

                <input
                    id="editScreenshots"
                    type="file"
                    accept="image/*"
                    multiple
                >

            </div>


            ${
                (location.screenshots || []).length
                ? `
                    <div class="section">

                        <div class="section-title">
                            Current Screenshots
                        </div>

                        <div class="screenshot-grid">

                            ${(location.screenshots || [])
                                .map(
                                    (image, index) =>
                                        `
                                        <div>
                                            <img
                                                class="screenshot"
                                                src="${image}"
                                                alt=""
                                            >

                                            <button
                                                onclick="removeScreenshot(${index})"
                                                class="danger-button"
                                                style="width:100%; margin-top:4px;"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        `
                                )
                                .join("")
                            }

                        </div>

                    </div>
                `
                : ""
            }


            <div class="editor-actions">

                <button
                    id="saveLocation"
                    class="primary-button"
                >
                    Save
                </button>

                <button
                    id="deleteLocation"
                    class="danger-button"
                >
                    Delete
                </button>

            </div>

        </div>

    `;


    document
        .getElementById("saveLocation")
        .addEventListener(
            "click",
            () => saveLocation(location)
        );


    document
        .getElementById("deleteLocation")
        .addEventListener(
            "click",
            () => deleteLocation(location)
        );


    document
        .getElementById("editScreenshots")
        .addEventListener(
            "change",
            event =>
                handleScreenshotUpload(
                    location,
                    event.target.files
                )
        );


    document
        .getElementById("editType")
        .addEventListener(
            "change",
            updateCustomTypeVisibility
        );

    updateCustomTypeVisibility();
}


/* =========================================================
   CUSTOM TYPE
========================================================= */

function updateCustomTypeVisibility() {

    const type =
        document.getElementById(
            "editType"
        );

    const container =
        document.getElementById(
            "customTypeContainer"
        );

    if (!type || !container) {
        return;
    }

    container.style.display =
        type.value === "Other"
            ? "block"
            : "none";
}


/* =========================================================
   SAVE LOCATION
========================================================= */

function saveLocation(location) {

    location.name =
        document.getElementById(
            "editName"
        ).value.trim();


    location.type =
        document.getElementById(
            "editType"
        ).value;


    location.customType =
        document.getElementById(
            "editCustomType"
        ).value.trim();


    if (
        location.type === "Other" &&
        location.customType
    ) {

        location.type =
            location.customType;
    }


    location.unit =
        document.getElementById(
            "editUnit"
        ).value.trim();


    location.shortDescription =
        document.getElementById(
            "editShortDescription"
        ).value;


    location.detailedDescription =
        document.getElementById(
            "editDetailedDescription"
        ).value;


    location.accessRequirements =
        document.getElementById(
            "editAccess"
        ).value;


    location.controlRequirements =
        document.getElementById(
            "editControls"
        ).value;


    location.equipment =
        splitLines(
            document.getElementById(
                "editEquipment"
            ).value
        );


    location.connectedRooms =
        splitLines(
            document.getElementById(
                "editConnections"
            ).value
        );


    location.tags =
        document
            .getElementById("editTags")
            .value
            .split(",")
            .map(
                tag => tag.trim()
            )
            .filter(Boolean);


    location.fandomUrl =
        document.getElementById(
            "editFandom"
        ).value.trim();


    location.color =
        document.getElementById(
            "editColor"
        ).value;


    saveState();

    renderMap();

    renderInfoPanel();
}


/* =========================================================
   DELETE LOCATION
========================================================= */

function deleteLocation(location) {

    if (
        !confirm(
            `Delete "${location.name}"?`
        )
    ) {

        return;
    }

    const floor =
        getCurrentFloor();

    floor.locations =
        floor.locations.filter(
            item =>
                item.id !==
                location.id
        );

    state.selectedLocationId =
        null;

    saveState();

    renderMap();

    renderEmptyPanel();
}


/* =========================================================
   SCREENSHOT UPLOAD
========================================================= */

function handleScreenshotUpload(
    location,
    files
) {

    if (!files.length) {
        return;
    }

    if (!location.screenshots) {
        location.screenshots = [];
    }


    Array.from(files).forEach(
        file => {

            const reader =
                new FileReader();

            reader.onload =
                event => {

                    location.screenshots.push(
                        event.target.result
                    );

                    saveState();

                    renderInfoPanel();

                };

            reader.readAsDataURL(file);

        }
    );
}


/* =========================================================
   REMOVE SCREENSHOT
========================================================= */

function removeScreenshot(index) {

    const floor =
        getCurrentFloor();

    const location =
        floor.locations.find(
            item =>
                item.id ===
                state.selectedLocationId
        );

    if (!location) {
        return;
    }

    location.screenshots.splice(
        index,
        1
    );

    saveState();

    renderInfoPanel();
}


/* =========================================================
   EDITOR MODE
========================================================= */

document
    .getElementById("editButton")
    .addEventListener(
        "click",
        () => {

            if (state.editorMode) {

                state.editorMode =
                    false;

                state.drawingMode =
                    "select";

                state.drawingPoints =
                    [];

                document
                    .getElementById(
                        "editButton"
                    )
                    .textContent =
                    "🔒 Edit";

                updateEditorUI();

                renderMap();

                renderInfoPanel();

                return;
            }

            passwordModal.classList.remove(
                "hidden"
            );

            passwordInput.value = "";

            passwordError.classList.add(
                "hidden"
            );

            passwordInput.focus();
        }
    );


function updateEditorUI() {

    if (state.editorMode) {

        editorToolbar.classList.remove(
            "hidden"
        );

        document
            .getElementById(
                "editButton"
            )
            .textContent =
            "🔓 Editing";

    } else {

        editorToolbar.classList.add(
            "hidden"
        );

        document
            .getElementById(
                "editButton"
            )
            .textContent =
            "🔒 Edit";
    }
}


/* =========================================================
   PASSWORD
========================================================= */

document
    .getElementById(
        "closePasswordModal"
    )
    .addEventListener(
        "click",
        () => {

            passwordModal.classList.add(
                "hidden"
            );
        }
    );


document
    .getElementById(
        "passwordSubmit"
    )
    .addEventListener(
        "click",
        enterEditor
    );


passwordInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            enterEditor();
        }
    }
);


async function enterEditor() {

    const password =
        passwordInput.value;

    const hash =
        await sha256(password);

    /*
        NOTE:
        This is client-side protection only.

        It prevents casual access but should not be
        treated as true authentication for a public
        production website.
    */

    if (
        hash ===
        CONFIG.passwordHash
    ) {

        state.editorMode =
            true;

        passwordModal.classList.add(
            "hidden"
        );

        updateEditorUI();

        renderMap();

        renderInfoPanel();

    } else {

        passwordError.classList.remove(
            "hidden"
        );

    }
}


/* =========================================================
   DRAWING TOOLS
========================================================= */

document
    .getElementById(
        "rectangleTool"
    )
    .addEventListener(
        "click",
        () => {

            if (!state.editorMode) {
                return;
            }

            state.drawingMode =
                "rectangle";

            state.drawingPoints =
                [];

            updateToolButtons();
        }
    );


document
    .getElementById(
        "polygonTool"
    )
    .addEventListener(
        "click",
        () => {

            if (!state.editorMode) {
                return;
            }

            state.drawingMode =
                "polygon";

            state.drawingPoints =
                [];

            updateToolButtons();
        }
    );


document
    .getElementById(
        "selectTool"
    )
    .addEventListener(
        "click",
        () => {

            state.drawingMode =
                "select";

            state.drawingPoints =
                [];

            updateToolButtons();

            renderMap();
        }
    );


document
    .getElementById(
        "cancelDrawing"
    )
    .addEventListener(
        "click",
        () => {

            state.drawingPoints =
                [];

            state.drawingMode =
                "select";

            updateToolButtons();

            renderMap();
        }
    );


function updateToolButtons() {

    document
        .getElementById(
            "rectangleTool"
        )
        .classList.toggle(
            "active",
            state.drawingMode ===
                "rectangle"
        );


    document
        .getElementById(
            "polygonTool"
        )
        .classList.toggle(
            "active",
            state.drawingMode ===
                "polygon"
        );


    document
        .getElementById(
            "selectTool"
        )
        .classList.toggle(
            "active",
            state.drawingMode ===
                "select"
        );
}


/* =========================================================
   MAP CLICK
========================================================= */

mapSvg.addEventListener(
    "click",
    event => {

        if (!state.editorMode) {
            return;
        }

        if (
            state.drawingMode ===
            "select"
        ) {
            return;
        }


        const point =
            screenToMap(
                event.clientX,
                event.clientY
            );


        if (
            state.drawingMode ===
            "rectangle"
        ) {

            createRectangle(
                point
            );

            return;
        }


        if (
            state.drawingMode ===
            "polygon"
        ) {

            state.drawingPoints.push(
                point
            );

            renderMap();

        }

    }
);


/* =========================================================
   DOUBLE CLICK TO FINISH POLYGON
========================================================= */

mapSvg.addEventListener(
    "dblclick",
    event => {

        if (
            !state.editorMode ||
            state.drawingMode !==
                "polygon"
        ) {

            return;
        }

        event.preventDefault();

        if (
            state.drawingPoints.length <
            3
        ) {

            alert(
                "A polygon needs at least 3 points."
            );

            return;
        }

        createPolygon();
    }
);


/* =========================================================
   CREATE RECTANGLE
========================================================= */

function createRectangle(
    point
) {

    const location = {

        id:
            "location_" +
            state.nextLocationId++,

        name:
            "New Location",

        shape:
            "rectangle",

        type:
            "Room",

        customType:
            "",

        unit:
            "",

        x:
            point.x - 100,

        y:
            point.y - 60,

        width:
            200,

        height:
            120,

        color:
            "#4feaff",

        shortDescription:
            "",

        detailedDescription:
            "",

        accessRequirements:
            "",

        controlRequirements:
            "",

        fandomUrl:
            "",

        screenshots:
            [],

        notes:
            "",

        equipment:
            [],

        connectedRooms:
            [],

        tags:
            []
    };


    getCurrentFloor()
        .locations
        .push(location);


    state.selectedLocationId =
        location.id;


    state.drawingMode =
        "select";


    saveState();

    updateToolButtons();

    renderMap();

    renderInfoPanel();
}


/* =========================================================
   CREATE POLYGON
========================================================= */

function createPolygon() {

    const points =
        [...state.drawingPoints];


    const location = {

        id:
            "location_" +
            state.nextLocationId++,

        name:
            "New Location",

        shape:
            "polygon",

        type:
            "Room",

        customType:
            "",

        unit:
            "",

        points,

        color:
            "#4feaff",

        shortDescription:
            "",

        detailedDescription:
            "",

        accessRequirements:
            "",

        controlRequirements:
            "",

        fandomUrl:
            "",

        screenshots:
            [],

        notes:
            "",

        equipment:
            [],

        connectedRooms:
            [],

        tags:
            []
    };


    getCurrentFloor()
        .locations
        .push(location);


    state.selectedLocationId =
        location.id;


    state.drawingPoints =
        [];

    state.drawingMode =
        "select";


    saveState();

    updateToolButtons();

    renderMap();

    renderInfoPanel();
}


/* =========================================================
   TEMPORARY POLYGON
========================================================= */

function drawTemporaryPolygon() {

    if (
        !state.editorMode ||
        state.drawingMode !==
            "polygon" ||
        state.drawingPoints.length === 0
    ) {

        return;
    }


    const polygon =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "polyline"
        );


    polygon.setAttribute(
        "points",
        state.drawingPoints
            .map(
                point =>
                    `${point.x},${point.y}`
            )
            .join(" ")
    );


    polygon.setAttribute(
        "fill",
        "none"
    );


    polygon.setAttribute(
        "stroke",
        "#4feaff"
    );


    polygon.setAttribute(
        "stroke-width",
        "3"
    );


    polygon.setAttribute(
        "stroke-dasharray",
        "8 6"
    );


    mapSvg.appendChild(
        polygon
    );
}


/* =========================================================
   POLYGON HANDLES
========================================================= */

function drawPolygonHandles(
    location
) {

    location.points.forEach(
        (point, index) => {

            const circle =
                document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "circle"
                );


            circle.classList.add(
                "vertex"
            );


            circle.setAttribute(
                "cx",
                point.x
            );


            circle.setAttribute(
                "cy",
                point.y
            );


            circle.setAttribute(
                "r",
                "7"
            );


            circle.addEventListener(
                "pointerdown",
                event => {

                    event.stopPropagation();

                    beginVertexDrag(
                        event,
                        location,
                        index
                    );
                }
            );


            mapSvg.appendChild(
                circle
            );

        }
    );
}


/* =========================================================
   DRAG POLYGON VERTEX
========================================================= */

function beginVertexDrag(
    event,
    location,
    index
) {

    event.preventDefault();

    const move =
        moveEvent => {

            const point =
                screenToMap(
                    moveEvent.clientX,
                    moveEvent.clientY
                );

            location.points[index] =
                point;

            renderMap();

        };


    const stop =
        () => {

            window.removeEventListener(
                "pointermove",
                move
            );

            window.removeEventListener(
                "pointerup",
                stop
            );

            saveState();

        };


    window.addEventListener(
        "pointermove",
        move
    );

    window.addEventListener(
        "pointerup",
        stop
    );
}


/* =========================================================
   PAN
========================================================= */

mapViewport.addEventListener(
    "pointerdown",
    event => {

        if (
            state.editorMode &&
            state.drawingMode !==
                "select"
        ) {

            return;
        }


        if (
            event.target.closest(
                ".map-location"
            ) ||
            event.target.closest(
                ".vertex"
            )
        ) {

            return;
        }


        view.dragging =
            true;

        view.dragStartX =
            event.clientX;

        view.dragStartY =
            event.clientY;

        view.originalX =
            view.x;

        view.originalY =
            view.y;

        mapViewport.classList.add(
            "dragging"
        );
    }
);


window.addEventListener(
    "pointermove",
    event => {

        if (!view.dragging) {
            return;
        }

        view.x =
            view.originalX +
            (
                event.clientX -
                view.dragStartX
            );

        view.y =
            view.originalY +
            (
                event.clientY -
                view.dragStartY
            );

        updateView();
    }
);


window.addEventListener(
    "pointerup",
    () => {

        view.dragging =
            false;

        mapViewport.classList.remove(
            "dragging"
        );
    }
);


/* =========================================================
   ZOOM
========================================================= */

mapViewport.addEventListener(
    "wheel",
    event => {

        event.preventDefault();

        const direction =
            event.deltaY < 0
                ? 1
                : -1;


        const oldZoom =
            view.zoom;


        view.zoom *=
            direction === 1
                ? 1.1
                : 0.9;


        view.zoom =
            Math.max(
                0.2,
                Math.min(
                    4,
                    view.zoom
                )
            );


        /*
            Keep zoom centred around cursor.
        */

        const rect =
            mapViewport.getBoundingClientRect();


        const mouseX =
            event.clientX -
            rect.left -
            rect.width / 2;


        const mouseY =
            event.clientY -
            rect.top -
            rect.height / 2;


        const zoomRatio =
            view.zoom /
            oldZoom;


        view.x =
            mouseX -
            (mouseX - view.x) *
            zoomRatio;


        view.y =
            mouseY -
            (mouseY - view.y) *
            zoomRatio;


        updateView();
    },
    {
        passive: false
    }
);


document
    .getElementById("zoomIn")
    .addEventListener(
        "click",
        () => {

            view.zoom =
                Math.min(
                    4,
                    view.zoom * 1.15
                );

            updateView();
        }
    );


document
    .getElementById("zoomOut")
    .addEventListener(
        "click",
        () => {

            view.zoom =
                Math.max(
                    0.2,
                    view.zoom * 0.87
                );

            updateView();
        }
    );


document
    .getElementById("resetView")
    .addEventListener(
        "click",
        resetView
    );


function resetView() {

    view.x = 0;
    view.y = 0;
    view.zoom = 1;

    updateView();
}


function updateView() {

    mapCanvas.style.transform =
        `translate(
            calc(-50% + ${view.x}px),
            calc(-50% + ${view.y}px)
        )
        scale(${view.zoom})`;


    document
        .getElementById("zoomLabel")
        .textContent =
        `${Math.round(view.zoom * 100)}%`;
}


/* =========================================================
   SCREEN → MAP COORDINATES
========================================================= */

function screenToMap(
    screenX,
    screenY
) {

    const rect =
        mapViewport.getBoundingClientRect();


    const viewportX =
        screenX -
        rect.left -
        rect.width / 2;


    const viewportY =
        screenY -
        rect.top -
        rect.height / 2;


    return {

        x:
            (
                viewportX -
                view.x
            ) /
            view.zoom +
            2500,

        y:
            (
                viewportY -
                view.y
            ) /
            view.zoom +
            2500
    };
}


/* =========================================================
   EXPORT
========================================================= */

function exportMap() {

    const exportData = {

        format:
            "RBWR Facility Atlas",

        version:
            1,

        exportedAt:
            new Date().toISOString(),

        floors:
            state.floors,

        currentFloorId:
            state.currentFloorId,

        nextLocationId:
            state.nextLocationId,

        nextFloorId:
            state.nextFloorId
    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    exportData,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "RBWR-Facility-Atlas.json";


    link.click();


    URL.revokeObjectURL(url);
}


/* =========================================================
   IMPORT
========================================================= */

function importMap() {

    if (!state.editorMode) {

        alert(
            "Importing maps is only available in editor mode."
        );

        return;
    }

    importFile.click();
}


importFile.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            () => {

                try {

                    const imported =
                        JSON.parse(
                            reader.result
                        );


                    if (
                        !imported.floors
                    ) {

                        throw new Error(
                            "Invalid map file."
                        );
                    }


                    state.floors =
                        imported.floors;

                    state.currentFloorId =
                        imported.currentFloorId ||
                        state.floors[0].id;

                    state.nextLocationId =
                        imported.nextLocationId ||
                        1;

                    state.nextFloorId =
                        imported.nextFloorId ||
                        2;

                    state.selectedLocationId =
                        null;


                    saveState();

                    renderFloors();

                    renderMap();

                    renderEmptyPanel();


                    alert(
                        "Map imported successfully."
                    );

                }

                catch (error) {

                    alert(
                        "Could not import this map file."
                    );

                    console.error(error);

                }

            };


        reader.readAsText(file);

        event.target.value = "";
    }
);


/* =========================================================
   ADD IMPORT / EXPORT BUTTONS
========================================================= */

const importExportContainer =
    document.createElement("div");

importExportContainer.style.display =
    "flex";

importExportContainer.style.gap =
    "6px";


const exportButton =
    document.createElement("button");

exportButton.textContent =
    "Export";


exportButton.addEventListener(
    "click",
    exportMap
);


const importButton =
    document.createElement("button");

importButton.textContent =
    "Import";


importButton.addEventListener(
    "click",
    importMap
);


importExportContainer.appendChild(
    exportButton
);

importExportContainer.appendChild(
    importButton
);


document
    .querySelector(".toolbar")
    .insertBefore(
        importExportContainer,
        document.getElementById(
            "themeButton"
        )
    );


/* =========================================================
   THEME
========================================================= */

document
    .getElementById("themeButton")
    .addEventListener(
        "click",
        toggleTheme
    );


function loadTheme() {

    const theme =
        localStorage.getItem(
            CONFIG.themeKey
        );


    if (theme === "light") {

        document.body.classList.add(
            "light"
        );
    }
}


function toggleTheme() {

    document.body.classList.toggle(
        "light"
    );


    localStorage.setItem(
        CONFIG.themeKey,

        document.body.classList.contains(
            "light"
        )
            ? "light"
            : "dark"
    );
}


/* =========================================================
   HELPERS
========================================================= */

function splitLines(value) {

    return value
        .split("\n")
        .map(
            line =>
                line.trim()
        )
        .filter(Boolean);
}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


/* =========================================================
   SHA-256
========================================================= */

async function sha256(value) {

    const data =
        new TextEncoder()
            .encode(value);


    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );


    const hashArray =
        Array.from(
            new Uint8Array(
                hashBuffer
            )
        );


    return hashArray
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


/* =========================================================
   PASSWORD HASH GENERATOR

   Open the browser console and run:

   generatePasswordHash("your password")

   It will print the SHA-256 hash.

========================================================= */

window.generatePasswordHash =
    async function(password) {

        console.log(
            await sha256(password)
        );

    };
