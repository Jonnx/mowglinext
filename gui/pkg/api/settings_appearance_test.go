package api

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/mowglinext/mowglinext/pkg/types"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestLegacyMowerAppearanceUpgrade(t *testing.T) {
	chdirToGuiRoot(t)
	resetSchemaCache()
	t.Cleanup(resetSchemaCache)
	for _, tc := range []struct{ name, legacy, explicit, want string }{
		{"custom RM1000", "biltema-rm1000", "", "rm1000"},
		{"new choice wins", "biltema-rm1000", "    mower_visual_style: yardforce\n", "yardforce"},
		{"explicit model default wins", "biltema-rm1000", "    mower_visual_style: \"\"\n", ""},
		{"generic follows model", "generic", "", ""},
		{"no legacy selection", "", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			original := "mowgli:\n  ros__parameters:\n    mower_model: CUSTOM\n" + tc.explicit
			path := createTempYAMLFile(t, original)
			db := types.NewMockDBProvider()
			db.Set("system.mower.yamlConfigFile", []byte(path))
			if tc.legacy != "" {
				db.Set("gui.map.mower.appearance", []byte(tc.legacy))
			}
			router := setupSettingsRouter(db)
			read := func() map[string]any {
				w := httptest.NewRecorder()
				router.ServeHTTP(w, httptest.NewRequest("GET", "/api/settings/yaml", nil))
				require.Equal(t, 200, w.Code, w.Body.String())
				var flat map[string]any
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &flat))
				return flat
			}
			save := func(payload map[string]any) {
				body, err := json.Marshal(payload)
				require.NoError(t, err)
				w := httptest.NewRecorder()
				router.ServeHTTP(w, httptest.NewRequest("POST", "/api/settings/yaml", bytes.NewReader(body)))
				require.Equal(t, 200, w.Code, w.Body.String())
			}
			require.Equal(t, tc.want, read()["mower_visual_style"])
			data, err := os.ReadFile(path)
			require.NoError(t, err)
			require.Equal(t, original, string(data), "GET must not rewrite config")
			// Even an unrelated save must persist the effective appearance.
			save(map[string]any{"chassis_mass_kg": 12.34})
			require.Equal(t, tc.want, read()["mower_visual_style"])
			data, err = os.ReadFile(path)
			require.NoError(t, err)
			var document map[string]any
			require.NoError(t, yaml.Unmarshal(data, &document))
			require.Equal(t, tc.want, flattenROS2YAML(document)["mower_visual_style"])
			// A new choice wins, including resetting/removing it. A subsequent
			// unrelated save must not resurrect the retained legacy DB value.
			for _, reset := range []any{"", nil} {
				save(map[string]any{"mower_visual_style": "yardforce"})
				require.Equal(t, "yardforce", read()["mower_visual_style"])
				save(map[string]any{"mower_visual_style": reset})
				save(map[string]any{"chassis_mass_kg": 11.0})
				require.Equal(t, "", read()["mower_visual_style"])
			}
		})
	}
}
