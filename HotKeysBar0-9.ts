import type { PluginLayer } from "client/src/layers/Plugins/createPluginLayer";
import type { Entity } from "@latticexyz/recs";

function createPlugin(pluginLayer: PluginLayer) {
  // -------------------------------------
  // Setup Plugin API
  // SETUP Pluginlayer used functions and components
  const {
    ui: {
      preact: {
        html,
        render,
        h,
        hooks: { useState },
      },
      components: { Sprite },
    },
    api: { getSelectedEntity, getUnitType },
    hotkeyManager,
  } = pluginLayer;
  // SETUP pluginLayer.parentLayers.local used functions and components
  const {
    api: { selectEntity },
  } = pluginLayer.parentLayers.local;
  // SETUP interface got Hotkey btns
  interface HotkeyButtonProps {
    hotkey: string;
    symbol: string;
    entityId?: Entity;
  }

  // Initialize an object to store the saved entities for each button
  const savedEntities: Record<string, Entity | undefined> = {};

  const HotkeyButton = ({ hotkey, symbol }: HotkeyButtonProps) => {
    const [clicked, setClicked] = useState(false);
    const savedEntity = savedEntities[hotkey];

    const handleClick = () => {
      const selectedEntity = getSelectedEntity();
      if (!selectedEntity) return;

      if (selectedEntity) {
        // Handle click action
        savedEntities[hotkey] = selectedEntity;
        // Save the entityId for the button
      }
      setClicked(true); // Toggle clicked state
      setTimeout(() => setClicked(false), 100); // Reset clicked state after 100ms
    };

    hotkeyManager.addHotkey(hotkey, () => {
      if (savedEntities[hotkey]) {
        selectEntity(savedEntities[hotkey] as Entity); // Save the entityId for the button
      } else {
        const selectedEntity = getSelectedEntity();
        if (selectedEntity) {
          savedEntities[hotkey] = selectedEntity;
        }
      }

      setClicked(true); // Toggle clicked state
      setTimeout(() => setClicked(false), 100); // Reset clicked state after 100ms
    });

    return html`
      <button
        class="hotkey-button"
        style=${{
          width: "40px",
          height: "40px",
          margin: "5px",
          border: "1px solid black",
          boxShadow: clicked ? "0 0 5px 2px rgba(0, 0, 0, 0.5)" : "none", // Add shadow effect when clicked
          backgroundColor: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "0",
        }}
        onclick=${handleClick}
      >
        <div
          style=${{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "90%",
            height: "90%",
          }}
        >
          ${savedEntity
            ? html`<${Sprite}
                unitType=${getUnitType(savedEntity)}
                scale=${1}
                colorName="green"
                style=${{ maxWidth: "100%", maxHeight: "100%" }}
              />`
            : symbol}
        </div>
      </button>
    `;
  };

  const App = () => {
    const buttons: HotkeyButtonProps[] = [];
    let hotkey = `${0}`;
    let symbol = `${0}`;
    for (let i = 0; i <= 9; i++) {
      if (i === 0) {
        hotkey = `${0}`;
        symbol = `${0}`;
        buttons.push({ hotkey, symbol }); // Initialize with entityId undefined
        continue;
      }

      hotkey = `${i}`;
      symbol = `${i}`;

      buttons.push({ hotkey, symbol }); // Initialize with entityId undefined
    }

    return html`
      <div
        class="button-row"
        style=${{
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        ${buttons.map((button) => html`<${HotkeyButton} ...${button} />`)}
      </div>
    `;
  };

  return {
    mount: (container: HTMLDivElement) => {
      render(h(App, {}), container); // Render the App component into the provided container
    },
    unmount: () => {
      // Remove hotkeys
      for (let i = 0; i <= 9; i++) {
        hotkeyManager.removeHotkey(String(i));
      }
    },
  };
}
