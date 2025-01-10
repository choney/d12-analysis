/*******************************************************
 * Utility / Helper Functions
 ******************************************************/

function createHeaderCell(value, hoverText) {
  const header = document.createElement("TH");
  const span = document.createElement("SPAN");
  span.title = hoverText;
  span.textContent = value;
  header.appendChild(span);
  header.setAttribute("style", "border: 1px solid black; padding: 3px; word-wrap: normal;");
  return header;
}

function createNormalCell(value, colors) {
  const cell = document.createElement("TD");
  cell.setAttribute("style", "border: 1px solid black; padding: 3px;");
  if (colors[value]) {
    cell.style.color = colors[value];
  }
  cell.textContent = value;
  return cell;
}

function createRow(valuesArray, colors) {
  const tableRow = document.createElement("TR");
  for (let i = 0; i < valuesArray.length; i++) {
    tableRow.appendChild(createNormalCell(valuesArray[i], colors));
  }
  return tableRow;
}

function createTable(attack, defend, colors, troopsGained) {
  const table = document.createElement("TABLE");
  table.setAttribute("style", "width:100%; border-collapse: collapse; border: 1px solid black;");

  // Table header
  const tableHeaderRow = document.createElement("TR");
  const headers = [
    "Name", "Troops Gained", "Killed", "Lost", "KD",
    "Killed Attacking", "Lost Attacking", "Attack KD",
    "Killed Defending", "Lost Defending", "Defense KD"
  ];

  const hoverText = [
    "Player's username",
    "Total number of troops gained (from area bonus or card turn-ins)",
    "Total number of opponent's troops each player has killed",
    "Total number of troops each player has lost",
    "Kill/Death ratio = Killed / Lost",
    "Total number of troops each player has killed while attacking",
    "Total number of troops each player has lost while attacking",
    "Attack KD = Killed Attacking / Lost Attacking",
    "Total number of opponent's troops killed while defending",
    "Total number of troops each player has lost while defending",
    "Defense KD = Killed Defending / Lost Defending"
  ];

  for (let i = 0; i < headers.length; i++) {
    tableHeaderRow.appendChild(createHeaderCell(headers[i], hoverText[i]));
  }
  table.appendChild(tableHeaderRow);

  // Build the table rows
  let names = new Set([
    ...Object.keys(attack),
    ...Object.keys(defend),
    ...Object.keys(troopsGained),
  ]);
  // Convert Set to array and sort
  names = Array.from(names).sort();

  for (const name of names) {
    const currAttack = attack[name] || [0, 0];
    const currDefend = defend[name] || [0, 0];
    const totalKilled = currAttack[0] + currDefend[0];
    const totalLost   = currAttack[1] + currDefend[1];
    
    // Calculate KDs
    const kd         = totalKilled === 0 ? 0 : totalLost === 0 ? Infinity : (totalKilled/totalLost).toFixed(2);
    const attackKd   = currAttack[0] === 0 ? 0 : currAttack[1] === 0 ? Infinity : (currAttack[0]/currAttack[1]).toFixed(2);
    const defendKd   = currDefend[0] === 0 ? 0 : currDefend[1] === 0 ? Infinity : (currDefend[0]/currDefend[1]).toFixed(2);
    const gained     = troopsGained[name] || 0;

    const rowData = [
      name,
      gained,
      totalKilled,
      totalLost,
      kd,
      currAttack[0],
      currAttack[1],
      attackKd,
      currDefend[0],
      currDefend[1],
      defendKd
    ];

    const row = createRow(rowData, colors);
    table.appendChild(row);
  }

  return table;
}

/*******************************************************
 * Parsing Logic (replaces runAnalysis in content.js)
 ******************************************************/

/**
 * parseLogText(logText):
 *   - Splits text by lines
 *   - Looks for patterns "attacked", "killing X losing Y", "received X troop"
 *   - Updates the data structures for attack, defend, troopsGained, etc.
 *   - Colors are arbitrary or you can ignore them, 
 *     because in the original code they came from the game’s DOM.
 */
function parseLogText(logText) {
  // Initialize maps
  const attack = {};
  const defend = {};
  const troopsGained = {};
  const colors = {};  // Optionally define player colors if you wish

  // Split the entire log text into lines
  const lines = logText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const message = lines[i];
    if (!message) continue;

    // 1) Look for "attacked ... killing X losing Y"
    if (message.includes("attacked") && message.match(/killing\s(\d{1,2})/) && message.match(/losing\s(\d{1,2})/)) {
      const killed = parseInt(message.match(/killing\s(\d{1,2})/)[1], 10);
      const lost   = parseInt(message.match(/losing\s(\d{1,2})/)[1], 10);

      // The original code tries to parse player names with a bracket pattern like (PlayerName).
      // If your logs follow the same pattern, you can attempt a simplified approach:
      // e.g.: "ABC (Player1) attacked XYZ (Player2) killing 3 losing 2"

      // One approach: split at "attacked"
      const [leftSide, rightSide] = message.split("attacked");

      // Extract names from parentheses. 
      // We'll guess that the last parentheses on each side is the player's name.
      const firstMatches  = leftSide.match(/\(([a-zA-Z0-9_-]+)\)/g);
      const secondMatches = rightSide.match(/\(([a-zA-Z0-9_-]+)\)/g);

      let firstPlayer  = firstMatches ? firstMatches[firstMatches.length - 1] : "(UnknownA)";
      let secondPlayer = secondMatches ? secondMatches[secondMatches.length - 1] : "(UnknownB)";

      // Remove parentheses
      firstPlayer  = firstPlayer.replace(/[()]/g, "");
      secondPlayer = secondPlayer.replace(/[()]/g, "");

      // Ensure objects exist
      if (!attack[firstPlayer]) attack[firstPlayer] = [0, 0];
      if (!defend[firstPlayer]) defend[firstPlayer] = [0, 0];
      if (!attack[secondPlayer]) attack[secondPlayer] = [0, 0];
      if (!defend[secondPlayer]) defend[secondPlayer] = [0, 0];

      // Update
      attack[firstPlayer][0] += killed; // kills
      attack[firstPlayer][1] += lost;   // losses
      defend[secondPlayer][0] += lost;  // kills while defending
      defend[secondPlayer][1] += killed; // losses while defending

    // 2) Look for "received X troop"
    } else if (message.includes("received") && message.includes("troop")) {
      // e.g. "Bob received 2 troops"
      // If the line always starts with "<Name> received <N> troop"
      // we can just do a quick split:
      const segments = message.trim().split(" ");
      // segments[0] = "Bob", segments[1] = "received", segments[2] = "2", segments[3] = "troops"
      const name   = segments[0];
      const troops = parseInt(segments[2], 10);

      if (!troopsGained[name]) {
        troopsGained[name] = troops;
      } else {
        troopsGained[name] += troops;
      }
    }
  }

  // Return the data structures
  return { attack, defend, troopsGained, colors };
}


/*******************************************************
 * Putting it all together in the UI
 ******************************************************/

// On page load, attach the "Analyze" button listener
document.addEventListener("DOMContentLoaded", () => {
  const analyzeButton = document.getElementById("analyzeButton");
  const logInput      = document.getElementById("logInput");
  const analysisDiv   = document.getElementById("analysisResults");

  analyzeButton.addEventListener("click", () => {
    const rawLog = logInput.value;
    if (!rawLog || !rawLog.trim()) {
      analysisDiv.innerHTML = "<p style='color:red;'>Please paste your log first!</p>";
      return;
    }

    // 1) Parse the text
    const { attack, defend, troopsGained, colors } = parseLogText(rawLog);

    // 2) Build the results table
    const table = createTable(attack, defend, colors, troopsGained);

    // 3) Clear the old results and show the new table
    analysisDiv.innerHTML = "";
    analysisDiv.appendChild(table);
  });
});
