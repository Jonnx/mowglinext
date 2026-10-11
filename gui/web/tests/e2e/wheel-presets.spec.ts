import {expect, test} from "@playwright/test";
import {installMockBackend} from "./mock/mockBackend";

for (const model of ["YardForce SA650", "YardForce 900 ECO", "YardForce LUV1000RI", "Sabo MOWiT 500F"]) {
    test(`${model} applies wheel radii in metres only after confirming the preset`, async ({page}) => {
        const writes: string[]=[];
        page.on("request", request => {
            if(request.method() !== "GET" && !request.url().includes("/config/keys/get")) writes.push(request.url());
        });
        await page.addInitScript(() => localStorage.setItem("mowglinext.lang","en"));
        await installMockBackend(page, {name:"wheel-presets",rest:{
            "/api/settings/yaml":{mower_model:"CUSTOM",wheel_radius:0.04475,caster_radius:0.03},
        }});
        await page.goto('/#/settings?section=hardware');
        const wheel=page.getByRole('spinbutton',{name:'Wheel Radius, m',exact:true});
        await expect(wheel).toHaveValue('0.04475');
        await page.getByRole('radio',{name:model,exact:true}).click();
        const confirm=page.getByRole('dialog');
        await expect(confirm).toBeVisible();
        await expect(wheel).toHaveValue('0.04475');
        await confirm.getByRole('button',{name:'Apply preset',exact:true}).click();
        await expect(wheel).toHaveValue(/^0\.0950*$/);
        await page.getByText('Chassis & Geometry',{exact:true}).click();
        await expect(page.getByRole('spinbutton',{name:'Caster Radius, m',exact:true})).toHaveValue('0.045');
        // Applying a preset edits the draft; an update must not silently rewrite
        // an existing robot's calibration or send a restart/actuation command.
        expect(writes).toEqual([]);
    });
}
