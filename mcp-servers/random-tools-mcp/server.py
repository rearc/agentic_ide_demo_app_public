import random

from mcp.server.mcpserver import MCPServer

mcp = MCPServer("random-tools")


@mcp.tool()
def coin_flip() -> str:
    """Flip a fair coin and return 'heads' or 'tails'."""
    return random.choice(["heads", "tails"])


@mcp.tool()
def roll_die(sides: int = 6) -> int:
    """Roll an N-sided die and return a result from 1 to `sides` (default 6)."""
    if sides < 2:
        raise ValueError("a die needs at least 2 sides")
    return random.randint(1, sides)


if __name__ == "__main__":
    mcp.run()
