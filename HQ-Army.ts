import { Entity, getComponentValueStrict } from "@latticexyz/recs";

import type { PluginLayer } from "client/src/layers/Plugins/createPluginLayer";

function createPlugin(pluginLayer: PluginLayer) {
  // -------------------------------------
  // Setup Plugin API and ENUMS
  enum UnitTypes {
    Unknown = 0,
    Swordsman = 1,
    Pikeman = 2,
    Halberdier = 3,
    Pillager = 4,
    Knight = 5,
    Dragoon = 6,
    Archer = 7,
    Catapult = 8,
    Marksman = 9,
    Brute = 10,
  }

  enum CombatArchetypes {
    Unknown = 0,
    Swordsman = 1,
    Pikeman = 2,
    Halberdier = 3,
    Pillager = 4,
    Knight = 5,
    Dragoon = 6,
    Archer = 7,
    Catapult = 8,
    Marksman = 9,
    Settlement = 10,
    SpawnSettlement = 11,
    GoldMine = 12,
    Brute = 13,
  }

  enum TerrainTypes {
    Unknown,
    Grass,
    Mountain,
    Forest,
  }

  enum StructureTypes {
    Unknown,
    Settlement,
    SpawnSettlement,
    WoodenWall,
    GoldMine,
    GoldCache,
  }
  // SETUP Pluginlayer used functions and components
  const {
    ui: {
      preact: {
        html,
        render,
        h,
        hooks: { useMemo, useEffect, useState },
      },
      hooks: { useMatchStatus, useSelectedEntity, useComponentValue },
      components: { Select, TextInput, Highlight, Sprite },
    },
    api: {
      getSelectedEntity,
      resetSelection,
      getAllAttackableEntities,
      isOwnedByCurrentPlayer,
      calculateCombatResult,
      getPosition,
      canAttack,
      canMoveToAndAttack,
      getEntityName,
      getPlayersInMatch,
      getPlayerDetails,
      getPlayerGold,
      onNewTurn,
      isUnit,
      getUnitType,
      getStructureType,
    },

    actions: { attack, move },
    hotkeyManager,
    tileHighlighter,
  } = pluginLayer;
  // SETUP  pluginLayer.parentLayers.network used functions and components
  const {
    components: {
      Position,
      OwnedBy,
      Match,
      Player,
      UnitType,
      TerrainType,
      StructureType,
      Factory,
      Combat,
      Untraversable,
      ArmorModifier,
      MoveDifficulty,
    },
    utils: { manhattan, findClosest, getOwningPlayer, isOwnedBy },
    network: { matchEntity },
    utils: { getTemplateValueStrict },
  } = pluginLayer.parentLayers.network;
  // SETUP  pluginLayer.parentLayers.headless used functions and components
  const {
    components: { NextPosition, OnCooldown },
    api: {
      calculateMovementPath,
      combat: { canRetaliate, isNeutralStructure, isPassive },
      getAttackableEntities,
    },
  } = pluginLayer.parentLayers.headless;
  // SETUP   pluginLayer.parentLayers.phaser used functions and components
  const {
    scenes: {
      Main: { phaserScene },
    },
    api: { buildAt: phaserBuildAt, selectAndView },
  } = pluginLayer.parentLayers.phaser;
  // SETUP  pluginLayer.parentLayers.local used functions and components
  const {
    api: { selectEntity },
  } = pluginLayer.parentLayers.local;

  // ----------------------------------------------
  // Start Plugin function

  /// Helper function to calculate distance between two entities
  const calculateDistance = (entity1: Entity, entity2: Entity) => {
    const position1 = getPosition(entity1);
    const position2 = getPosition(entity2);
    if (!position1 || !position2) return Infinity; // Return a large value if positions are not available
    return Math.sqrt(
      Math.pow(position2.x - position1.x, 2) +
        Math.pow(position2.y - position1.y, 2)
    );
  };

  // Find best target function with sorting by distance and potential health ! TODO check it !!!
  const findBestTarget = (attacker: Entity) => {
    const targets = getAllAttackableEntities(attacker);
    if (!targets || targets.length === 0) return;

    const closestTarget = findClosest(attacker, targets);

    if (
      closestTarget.distance === 1 &&
      (isArcher(attacker) || isCatapult(attacker))
    ) {
      return; // Return undefined if attacker is an archer or catapult and the closest target is at distance 1
    }

    const targetsF = targets.filter((t) => !isWoodenWall(t));

    targetsF.sort((target1, target2) => {
      const health1 = getHealth(target1) || 0;
      const health2 = getHealth(target2) || 0;

      const distance1 = calculateDistance(
        target1,
        closestTarget.Entity || undefined
      );
      const distance2 = calculateDistance(
        target2,
        closestTarget.Entity || undefined
      );

      // First, sort by distance
      if (distance1 !== distance2) {
        return distance1 - distance2;
      }

      // If distances are equal, sort by lowest health
      return health1 - health2;
    });

    let bestTarget: Entity | undefined;
    let mostDamage = 0;

    for (const target of targetsF) {
      const combatResult = calculateCombatResult(attacker, target);

      if (combatResult && combatResult.attackerDamage > mostDamage) {
        mostDamage = combatResult.attackerDamage;
        bestTarget = target;
      }
    }

    return bestTarget;
  };

  // TODO ho to recieve health for units and structure?
  function getHealth(entity) {
    if (isUnit(entity)) {
      const combatData = useComponentValue(Combat, entity as Entity);

      if (combatData) {
        return combatData.health | 0;
      }
    }
  }

  // Unit type checkers -
  function isSoldier(entity) {
    if (getUnitType(entity) == UnitTypes.Swordsman) {
      return true;
    }
    return false;
  }
  // basic check if is entity Pikeman
  function isPikeman(entity) {
    if (getUnitType(entity) == UnitTypes.Pikeman) {
      return true;
    }
    return false;
  }
  // basic check if is entity Halberdier
  function isHalberdier(entity) {
    if (getUnitType(entity) == UnitTypes.Halberdier) {
      return true;
    }
    return false;
  }
  // basic check if is entity Pillager
  function isPillager(entity) {
    if (getUnitType(entity) == UnitTypes.Pillager) {
      return true;
    }
    return false;
  }
  // basic check if is entity Kingth
  function isKnight(entity) {
    if (getUnitType(entity) == UnitTypes.Knight) {
      return true;
    }
    return false;
  }
  // basic check if is entity Dragon
  function isDragoon(entity) {
    if (getUnitType(entity) == UnitTypes.Dragoon) {
      return true;
    }
    return false;
  }
  // basic check if is entity Archer
  function isArcher(entity) {
    if (getUnitType(entity) == UnitTypes.Archer) {
      return true;
    }
    return false;
  }

  // basic check if is entity Archer
  function isWoodenWall(entity) {
    if (getStructureType(entity) == StructureTypes.WoodenWall) {
      return true;
    }
    return false;
  }
  // basic check if is entity Catapult
  function isCatapult(entity) {
    if (getUnitType(entity) == UnitTypes.Catapult) {
      return true;
    }
    return false;
  }
  // basic check if is entity Marksma
  function isMarksman(entity) {
    if (getUnitType(entity) == UnitTypes.Marksman) {
      return true;
    }
    return false;
  }

  // basic check if is entity Marksma
  function isBrute(entity) {
    if (getUnitType(entity) == UnitTypes.Brute) {
      return true;
    }
    return false;
  }
  // main Fortified const
  const fortifiedUnits = new Set(); // Initialize the set to store fortified units
  // function Add/Remove to fortify list
  const addFortified = () => {
    const selectedEntity = getSelectedEntity();
    if (!selectedEntity) return;

    console.log("Fortify mode!");

    const entity = selectedEntity;

    if (fortifiedUnits.has(entity)) {
      fortifiedUnits.delete(entity);
      console.log("Removed unit from fortification:", fortifiedUnits);
    } else {
      fortifiedUnits.add(entity);
      console.log("Added unit to fortification:", fortifiedUnits);
    }
  };
  // main Frenzy const
  const frenzyUnits = new Set(); // Initialize the set to store frenzy units
  // function Add/Remove to frenzy list
  const addFrenzy = () => {
    const selectedEntity = getSelectedEntity();
    if (!selectedEntity) return;

    console.log("Frenzy mode!");

    const entity = selectedEntity;

    if (frenzyUnits.has(entity)) {
      frenzyUnits.delete(entity);
      console.log("Removed unit from frenzy:", frenzyUnits);
    } else {
      frenzyUnits.add(entity);
      console.log("Added unit to frehzy:", frenzyUnits);
    }
  };

  // Main stack functions for Fortified
  const performFortActions1 = () => {
    performFortifiedUnitActionsATTACK();
  };

  // Function to perform actions for fortified units ATTACK
  function performFortifiedUnitActionsATTACK() {
    if (fortifiedUnits) {
      for (const entityId of fortifiedUnits) {
        if (!entityId) {
          console.error("Fortified entity not found:", entityId);
          fortifiedUnits.delete(entityId);
          continue;
        }

        const attackableEntities = getAllAttackableEntities(entityId as Entity);

        if (attackableEntities) {
          const bestTarget = findBestTarget(entityId as Entity);
          if (!bestTarget) return;
          if (canAttack(entityId as Entity, bestTarget)) {
            attack(entityId as Entity, bestTarget);
            continue;
          }
        }
      }
    }
  }
  // Main stack functions for Frenzy
  const performFrenzyActions1 = () => {
    performFrenzyUnitActionsATTACK();
  };

  // Function to perform actions for frenzy units ATTACK
  function performFrenzyUnitActionsATTACK() {
    if (frenzyUnits) {
      for (const entityId of frenzyUnits) {
        if (!entityId) {
          console.error("Frenzy entity not found:", entityId);
          continue;
        }
        const attackableEntities = getAllAttackableEntities(entityId as Entity);

        if (attackableEntities) {
          const bestTarget = findBestTarget(entityId as Entity);
          if (!bestTarget) continue;

          const prevSelected = getSelectedEntity();
          selectEntity(entityId as Entity);
          if (canAttack(entityId as Entity, bestTarget)) {
            if (prevSelected) {
              selectEntity(prevSelected as Entity);
            } else {
              resetSelection();
            }
            attack(entityId as Entity, bestTarget);
            continue;
          }

          selectEntity(entityId as Entity);
          const closestUnblockedPosition = canMoveToAndAttack(
            entityId as Entity,
            bestTarget
          );

          if (closestUnblockedPosition) {
            if (prevSelected) {
              selectEntity(prevSelected as Entity);
            } else {
              resetSelection();
            }
            move(entityId as Entity, closestUnblockedPosition, bestTarget);
            continue;
          }
        }
      }
    }
  }
  // original frenzy
  const frenzyMove = () => {
    const selectedEntity = getSelectedEntity();
    if (!selectedEntity) return;
    if (!isOwnedByCurrentPlayer(selectedEntity)) return;

    const bestTarget = findBestTarget(selectedEntity);
    if (!bestTarget) return;
    if (canAttack(selectedEntity, bestTarget)) {
      resetSelection();
      attack(selectedEntity, bestTarget);
      return;
    }

    const closestUnblockedPosition = canMoveToAndAttack(
      selectedEntity,
      bestTarget
    );
    if (closestUnblockedPosition) {
      resetSelection();
      move(selectedEntity, closestUnblockedPosition, bestTarget);
      return;
    }
  };

  // Frenzy attack without move any
  const frenzyStatic = () => {
    const selectedEntity = getSelectedEntity();
    if (!selectedEntity) return;
    if (!isOwnedByCurrentPlayer(selectedEntity)) return;

    const bestTarget = findBestTarget(selectedEntity);
    if (!bestTarget) return;

    if (canAttack(selectedEntity, bestTarget)) {
      resetSelection();
      attack(selectedEntity, bestTarget);
      return;
    }
  };

  return {
    mount: (container: HTMLDivElement) => {
      hotkeyManager.addHotkey("R", frenzyMove);
      hotkeyManager.addHotkey("r", frenzyStatic);
      hotkeyManager.addHotkey("F", addFrenzy);
      hotkeyManager.addHotkey("f", addFortified);

      const listContainer = document.createElement("div");
      listContainer.id = "lists-container";
      container.appendChild(listContainer);

      // Fortified List
      const fortifiedListContainer = document.createElement("div");
      fortifiedListContainer.style.display = "inline-block";
      fortifiedListContainer.style.width = "48%";
      fortifiedListContainer.style.marginRight = "2%";
      listContainer.appendChild(fortifiedListContainer);

      const fortifiedListHeader = document.createElement("h3");
      fortifiedListHeader.textContent = "Fortified Units";
      fortifiedListContainer.appendChild(fortifiedListHeader);

      // Frenzy List
      const frenzyListContainer = document.createElement("div");
      frenzyListContainer.style.display = "inline-block";
      frenzyListContainer.style.width = "48%";
      listContainer.appendChild(frenzyListContainer);

      const frenzyListHeader = document.createElement("h3");
      frenzyListHeader.textContent = "Frenzy Units";
      frenzyListContainer.appendChild(frenzyListHeader);

      function App() {
        const [showContent, setShowContent] = useState(false); // State variable to toggle visibility
        const selectedEntity = useSelectedEntity();
        const attackableEntities = useMemo(
          () => getAllAttackableEntities(selectedEntity),
          [selectedEntity]
        );

        // plugin dynamicly check if selected units
        useEffect(() => {
          tileHighlighter.clearAll();

          if (selectedEntity) {
            const bestTargetPosition = getPosition(
              findBestTarget(selectedEntity)
            );
            if (bestTargetPosition) {
              tileHighlighter.highlightTile(bestTargetPosition, 0xff0000, 0.5);
            }
          }

          return () => {
            tileHighlighter.clearAll();
          };
        }, [selectedEntity]);

        const [players, setPlayers] = useState<
          ReturnType<typeof getPlayerDetails>[]
        >([]);
        const [playerGold, setPlayerGold] = useState<
          ReturnType<typeof getPlayerGold>[]
        >([]);

        const matchStatus = useMatchStatus();

        useEffect(() => {
          const sub = onNewTurn(() => {
            const allPlayers = getPlayersInMatch();
            const playerDetails = allPlayers.map((player) =>
              getPlayerDetails(player)
            );
            setPlayers(playerDetails);

            const gold = allPlayers.map((player) => getPlayerGold(player));
            setPlayerGold(gold);

            // Delay execution of performFrenzytActions1() by 8.5 seconds
            setTimeout(() => {
              if (fortifiedUnits.size > 0) {
                performFortActions1();
              }
              if (frenzyUnits.size > 0) {
                performFrenzyActions1();
              }
            }, 8500);
          });

          return () => {
            sub.unsubscribe();
          };
        }, []);

        const highlightStyle = {
          color: "red",
          fontWeight: "bold",
        };

        const toggleContent = () => {
          setShowContent(!showContent); // Toggle showContent state
        };

        return html`
          <div
            style=${{
              maxWidth: "450px",
              width: "450px",
              maxHeight: "300px",
              height: "200px",
              overflow: "auto",
            }}
          >
            <div
              style=${{
                width: "100%",
                maxHeight: "200px",
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              <div
                style=${{
                  width: "49.5%",
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  borderRadius: "8px",
                  border: "2px solid #ccc",
                }}
              >
                ${Array.from(fortifiedUnits).map((unit) => {
                  const isSelected = getSelectedEntity() === unit;
                  return html`<div
                    style=${{
                      transform: "scale(0.55)",
                      display: "flex",
                      flexWrap: "wrap",
                      borderBottom: "2px solid #ccc",
                      borderRight: "2px solid #ccc",
                      border: isSelected ? "1px solid yellow" : "none", // Add border style based on selection
                    }}
                    onclick=${() => selectEntity(unit as Entity)}
                  >
                    <${Sprite}
                      unitType=${getUnitType(unit as Entity)}
                      scale=${2}
                      colorName="green"
                    />
                  </div>`;
                })}
              </div>

              <div
                style=${{
                  width: "49.5%",
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  borderRadius: "8px",
                  border: "2px solid darkviolet",
                }}
              >
                ${Array.from(frenzyUnits).map((unit) => {
                  const isSelected = getSelectedEntity() === unit;
                  return html`<div
                    style=${{
                      transform: "scale(0.55)",
                      display: "flex",
                      alignItems: "wrap",
                      borderBottom: "2px solid darkviolet",
                      borderRight: "2px solid darkviolet",
                      border: isSelected ? "1px solid yellow" : "none", // Add border style based on selection
                    }}
                    onclick=${() => selectEntity(unit as Entity)}
                  >
                    <${Sprite}
                      unitType=${getUnitType(unit as Entity)}
                      scale=${2}
                      colorName="green"
                    />
                  </div>`;
                })}
              </div>
            </div>

            <div>
              ${selectedEntity
                ? html`
                    <p>
                      There are currently
                      <span style=${highlightStyle}
                        >${attackableEntities?.length ?? 0}</span
                      >
                      enemies in range.
                    </p>
                  `
                : null}
            </div>

            <!-- Button for toggling visibility -->
            <button
              style=${{
                border: "2px solid black",
                borderRadius: "8px",
              }}
              onclick=${toggleContent}
            >
              ${showContent ? "Hide info" : "Show more info"}
            </button>
            ${showContent &&
            html`
              <p>
                Press <span style=${highlightStyle}>F</span> to add/remove units
                to Frenzy loop for FRENZY your units to automatically execute
                the attack that
                <span style=${highlightStyle}>does the most damage</span>.
              </p>
              <p>
                Press <span style=${highlightStyle}>f</span> when selecting one
                of your units to automatically execute the fortification that
                <span style=${highlightStyle}>does the most damage</span>.
              </p>

              <p>
                Press <span style=${highlightStyle}>R</span> when selecting one
                of your units frenzy attack with move that
                <span style=${highlightStyle}>does the most damage</span>.
              </p>

              <p>
                Press <span style=${highlightStyle}>r</span> when selecting one
                of your units frenzy attack static that
                <span style=${highlightStyle}>does the most damage</span>.
              </p>
            `}
          </div>
        `;
      }

      render(h(App, {}), container);
    },
    unmount: () => {
      hotkeyManager.removeHotkey("R");
      hotkeyManager.removeHotkey("r");
      hotkeyManager.removeHotkey("f");
      hotkeyManager.removeHotkey("F");
    },
  };
}
