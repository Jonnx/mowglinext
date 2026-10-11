package api

import "github.com/mowglinext/mowglinext/pkg/types"

// Explicit YAML presence matters: an empty style means follow the hardware
// model, and must not resurrect a retired map preference after a reset.
// Reading never writes YAML or the DB; the next ordinary Save persists it.
func applyLegacyMowerAppearance(flat, explicit map[string]any, db types.IDBProvider) {
	if _, exists := explicit["mower_visual_style"]; exists {
		return
	}
	legacy, err := db.Get("gui.map.mower.appearance")
	if err == nil && string(legacy) == "biltema-rm1000" {
		flat["mower_visual_style"] = "rm1000"
	}
}
