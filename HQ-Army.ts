import { Entity } from "@latticexyz/recs";

import type { PluginLayer } from "client/src/layers/Plugins/createPluginLayer";

function createPlugin(pluginLayer: PluginLayer) {
  // -------------------------------------
  // Setup Plugin API
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

  const {
    ui: {
      preact: {
        html,
        render,
        h,
        hooks: { useMemo, useEffect, useState },
      },
      hooks: { useMatchStatus, useSelectedEntity, useComponentValue },
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

  const {
    components: { NextPosition, OnCooldown },
    api: {
      calculateMovementPath,
      combat: { canRetaliate, isNeutralStructure, isPassive },
      getAttackableEntities,
    },
  } = pluginLayer.parentLayers.headless;

  const {
    scenes: {
      Main: { phaserScene },
    },
    api: { buildAt: phaserBuildAt, selectAndView },
  } = pluginLayer.parentLayers.phaser;

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
    return Math.sqrt(Math.pow(position2.x - position1.x, 2) + Math.pow(position2.y - position1.y, 2));
  };

  // Find best target function with sorting by distance
  const findBestTarget = (attacker: Entity) => {
    const targets = getAllAttackableEntities(attacker);
    if (!targets || targets.length === 0) return;

    const closestTarget = findClosest(attacker, targets);

    if (closestTarget.distance === 1 && (isArcher(attacker) || isCatapult(attacker))) {
      return; // Return undefined if attacker is an archer or catapult and the closest target is at distance 1
    }

    const targetsF = targets.filter((t) => !isWoodenWall(t));

    targetsF.sort((target1, target2) => {
      const health1 = getHealth(target1) || 0;
      const health2 = getHealth(target2) || 0;

      const distance1 = calculateDistance(target1, closestTarget.Entity || undefined);
      const distance2 = calculateDistance(target2, closestTarget.Entity || undefined);

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

  // Unit type checkers

  function getHealth(entity) {
    if (isUnit(entity)) {
      const combatData = useComponentValue(Combat, entity as Entity);

      if (combatData) {
        return combatData.health | 0;
      }
    }
  }

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
    if (!HasValue(UnitType, entity)) {
      return false;
    }
    if (getUnitType(entity) == UnitTypes.Marksman) {
      return true;
    }
    return false;
  }

  // basic check if is entity Marksma
  function isBrute(entity) {
    if (!HasValue(UnitType, entity)) {
      return false;
    }
    if (getUnitType(entity) == UnitTypes.Brute) {
      return true;
    }
    return false;
  }

  const fortifiedUnits = new Set(); // Initialize the set to store fortified units

  const addFortified = () => {
    const selectedEntity = getSelectedEntity();
    if (!selectedEntity) return;

    console.log("Fortify mode!");

    const entity = selectedEntity;

    if (fortifiedUnits.has(entity)) {
      fortifiedUnits.delete(entity);
      console.log("Removed unit from fortification:", fortifiedUnits);
      createListUnits("fortified-list", fortifiedUnits);
    } else {
      fortifiedUnits.add(entity);
      console.log("Added unit to fortification:", fortifiedUnits);
      createListUnits("fortified-list", fortifiedUnits);
    }
  };

  const frenzyUnits = new Set(); // Initialize the set to store frenzy units

  const addFrenzy = () => {
    const selectedEntity = getSelectedEntity();
    if (!selectedEntity) return;

    console.log("Frenzy mode!");

    const entity = selectedEntity;

    if (frenzyUnits.has(entity)) {
      frenzyUnits.delete(entity);
      console.log("Removed unit from frenzy:", frenzyUnits);
      createListUnits("frenzy-list", frenzyUnits);
    } else {
      frenzyUnits.add(entity);
      console.log("Added unit to frehzy:", frenzyUnits);
      createListUnits("frenzy-list", frenzyUnits);
    }
  };

  function createListUnits(listId, items) {
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = ""; // Clear the list

    items.forEach((item, index) => {
      const listItem = document.createElement("div");
      listItem.classList.add("list-item");

      const unitName = getEntityName(item);
      const unitType = getUnitType(item);
      listItem.textContent = `${unitName}-${unitType}`;

      list.appendChild(listItem);
    });
  }

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
          createListUnits("fortified-list", fortifiedUnits);
          return;
        }

        const attackableEntities = getAllAttackableEntities(entityId as Entity);

        if (attackableEntities) {
          const bestTarget = findBestTarget(entityId as Entity);
          if (!bestTarget) return;
          selectEntity(entityId as Entity);
          if (canAttack(entityId as Entity, bestTarget)) {
            attack(entityId as Entity, bestTarget);
            return;
          }
        }
      }
    }
  }

  const performFrenzyActions1 = () => {
    performFrenzyUnitActionsATTACK();
  };

  // Function to perform actions for fortified units ATTACK
  function performFrenzyUnitActionsATTACK() {
    if (frenzyUnits) {
      for (const entityId of frenzyUnits) {
        if (!entityId) {
          console.error("Frenzy entity not found:", entityId);
          return;
        }
        const attackableEntities = getAllAttackableEntities(entityId as Entity);

        if (attackableEntities) {
          debugger;
          const bestTarget = findBestTarget(entityId as Entity);
          if (!bestTarget) return;
          selectEntity(entityId as Entity);
          if (canAttack(entityId as Entity, bestTarget)) {
            resetSelection();
            attack(entityId as Entity, bestTarget);
            return;
          }

          selectEntity(entityId as Entity);
          const closestUnblockedPosition = canMoveToAndAttack(entityId as Entity, bestTarget);

          if (closestUnblockedPosition) {
            resetSelection();
            move(entityId as Entity, closestUnblockedPosition, bestTarget);
            return;
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

    const closestUnblockedPosition = canMoveToAndAttack(selectedEntity, bestTarget);
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

      const fortifiedList = document.createElement("div");
      fortifiedList.id = "fortified-list";
      fortifiedListContainer.appendChild(fortifiedList);

      // Frenzy List
      const frenzyListContainer = document.createElement("div");
      frenzyListContainer.style.display = "inline-block";
      frenzyListContainer.style.width = "48%";
      listContainer.appendChild(frenzyListContainer);

      const frenzyListHeader = document.createElement("h3");
      frenzyListHeader.textContent = "Frenzy Units";
      frenzyListContainer.appendChild(frenzyListHeader);

      const frenzyList = document.createElement("div");
      frenzyList.id = "frenzy-list";
      frenzyListContainer.appendChild(frenzyList);

      createListUnits("fortified-list", fortifiedUnits);
      createListUnits("frenzy-list", frenzyUnits);

      function App() {
        const [showContent, setShowContent] = useState(false); // State variable to toggle visibility
        const selectedEntity = useSelectedEntity();
        const attackableEntities = useMemo(() => getAllAttackableEntities(selectedEntity), [selectedEntity]);

        // plugin dynamicly check if selected units
        useEffect(() => {
          tileHighlighter.clearAll();

          if (selectedEntity) {
            const bestTargetPosition = getPosition(findBestTarget(selectedEntity));
            if (bestTargetPosition) {
              tileHighlighter.highlightTile(bestTargetPosition, 0xff0000, 0.5);
            }
          }

          return () => {
            tileHighlighter.clearAll();
          };
        }, [selectedEntity]);

        const [players, setPlayers] = useState<ReturnType<typeof getPlayerDetails>[]>([]);
        const [playerGold, setPlayerGold] = useState<ReturnType<typeof getPlayerGold>[]>([]);

        const matchStatus = useMatchStatus();

        useEffect(() => {
          const sub = onNewTurn(() => {
            const allPlayers = getPlayersInMatch();
            const playerDetails = allPlayers.map((player) => getPlayerDetails(player));
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
          <div style=${{ maxWidth: "400px", width: "400px", maxHeight: "400px", height: "250px", overflow: "auto" }}>
            <!-- Button for toggling visibility -->
            <button onclick=${toggleContent}>${showContent ? "Hide" : "Show"}</button>
            ${showContent &&
            html`
              <p>
                Press <span style=${highlightStyle}>F</span> when selecting one of your units to automatically execute
                the attack that <span style=${highlightStyle}>does the most damage</span>.
              </p>
              <p>
                Press <span style=${highlightStyle}>f</span> when selecting one of your units to automatically execute
                the fortification that <span style=${highlightStyle}>does the most damage</span>.
              </p>

              ${selectedEntity
                ? html`
                    <p>
                      There are currently
                      <span style=${highlightStyle}>${attackableEntities?.length ?? 0}</span> enemies in range.
                    </p>
                  `
                : null}

              <div id="listContainer-container">
                <div id="listContainer"></div>
              </div>
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
