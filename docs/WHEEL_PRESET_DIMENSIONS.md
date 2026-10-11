# Drive-wheel and caster preset corrections

## Values and evidence

All configuration values below are **radii in metres**. On 2026-10-11 the
contributor reported SA650 rear-wheel diameter **190 mm** and caster diameter
**90 mm**. Dividing by two and converting millimetres to metres gives **0.095 m**
and **0.045 m**. The robot serial, tyre variant and measurement method were not
provided. These values must not be described as manufacturer specifications.

The contributor explicitly requested applying the same dimensions to the other
three presets as assumptions, replacing their implausible legacy rear-wheel size.
Those models have not been measured; shared values do not establish shared parts.

| GUI model | Old rear diameter | New rear diameter | Old caster diameter | New caster diameter | Basis |
| --- | ---: | ---: | ---: | ---: | --- |
| YardForce SA650 | 89.5 mm | 190 mm | 60 mm | 90 mm | Contributor report, 2026-10-11 |
| YardForce 900 ECO | 89.5 mm | 190 mm | 60 mm | 90 mm | Provisional SA650-based assumption |
| LUV1000RI | 89.5 mm | 190 mm | 60 mm | 90 mm | Provisional SA650-based assumption |
| Sabo MOWiT 500F | 89.5 mm | 190 mm | 70 mm | 90 mm | Provisional SA650-based assumption |

The measured YardForce 500/500B defaults remain unchanged. RM1000 and Custom
remain unchanged. The previous rear value came from the same 0.04475 m radius
copied across unrelated machines, as documented by commit `c0aa94fa`.

## Application and geometry impact

This is a **safety-critical geometry change**, not just artwork sizing.
Hardware and onboarding share `gui/web/src/constants/mowerModels.ts`; choosing
one of these presets proposes the new radii through the existing settings flow.
Existing saved files are not automatically migrated. An existing SA650 owner can
edit Wheel Radius and Caster Radius directly, avoiding reapplying unrelated model
preset values. Saving and restarting ROS applies the URDF change.

At upstream baseline `fd244fecace467d0046b28012bc29d5a4099220f`,
`mowgli.urdf.xacro` uses the rear radius for base_link's height above ground, drive
wheel visuals/collisions/inertia, and derived caster/blade transforms. Increasing
rear radius from 44.75 mm to 95 mm raises base_link by **50.25 mm**, also shifting
sensors mounted relative to it. Caster radius changes caster geometry and its
axle-height relationship. These are model changes, not measurements of an installed
sensor height. No wheel track, caster spacing, chassis dimensions, sensor mount,
encoder ticks-per-metre or firmware calibration is changed by this patch.

## Physical acceptance: HARDWARE_REQUIRED

Software checks do not validate these assumed dimensions. Before accepting each
preset for a physical mower, record:

- Exact model, serial/unit, wheel and tyre variant, wear and any spike attachments.
- The PR commit, installed GUI/ROS image IDs, URDF/config revision, firmware image
  and submodule revisions. No physical test has been run on any such baseline here.
- With power off, blades removed, and the mower stable with wheels immobilised,
  measure the rear and caster tyre outside diameters through each axle centre.
  Measure both sides; do not measure a hub cap, rim or image padding.
- Pass the proposed dimensions only if rear diameter is 190 mm and caster diameter
  is 90 mm within 5 mm on that exact setup. Otherwise reject the assumption, use
  measured radius overrides and report that model/variant for a preset correction.
- With motors inhibited, check the generated base_link-to-ground transform and
  wheel/caster positions against those measurements before any drive test. Recheck
  actual sensor heights after applying the model change.

This PR is independent of the layered-artwork and dashboard-illustration PRs.
