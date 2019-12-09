import { SideBarView, ViewItem, CustomTreeSection, By, WebDriver, VSBrowser } from 'vscode-extension-tester';
import { Dialog, Input, OutputViewExt, DefaultWait } from 'vscode-uitests-tooling';
import * as path from 'path';
import { assert } from 'chai';

describe('Start Camel K integration in Dev Mode and Basic', function () {

	let driver: WebDriver;

	const RESOURCES: string = path.resolve('src', 'ui-test', 'resources');
	const INTEGRATION_MESSAGE: string = 'Hello uitests!';

	const modes: { name: string, label: string }[] = [
		{ name: 'Dev Mode', label: 'Dev Mode - Apache Camel K Integration in Dev Mode' },
		{ name: 'Basic', label: 'Basic - Apache Camel K Integration (no ConfigMap or Secret)' }
	];

	const integrations: string[] = [
		'groovy-example.groovy', 'JavaExample.java', 'js-example.js', 'kotlin-example.kts', 'xml-example.xml'
	];

	before(async function () {
		this.timeout(30000);
		driver = VSBrowser.instance.driver;
		await Dialog.openFolder(RESOURCES);
		// TODO: need to wait for finishing of dependencies (kamel, kubectl) installation
		await DefaultWait.sleep(DefaultWait.TimePeriod.DEFAULT);
	});

	modes.forEach(function (_mode) {
		integrations.forEach(function (_integration) {
			describe('Integration - ' + _integration + ', ' + _mode.name, function () {

				const INTEGRATION_LABEL: string = _integration.split('.')[0].startsWith('Java') ? 'java-example' : _integration.split('.')[0];

				before(async function () {
					this.timeout(60000);
					await driver.wait(() => { return clearIntegrationsView(); }, 60000);
				});

				after(async function () {
					this.timeout(60000);
					const outputView = await OutputViewExt.open();
					await outputView.clearText();

					// manually delay each test for 5s to avoid kubernetes integrations flooding
					await DefaultWait.sleep(DefaultWait.TimePeriod.DEFAULT);
				});

				it('Start Apache Camel K integration - ' + _integration, async function () {
					this.timeout(30000);

					const viewSection = await new SideBarView().getContent().getSection('resources');
					const item = await viewSection.findItem(_integration) as ViewItem;
					const menu = await item.openContextMenu();
					await menu.select('Start Apache Camel K Integration');
					// TODO: wait until command palette is displayed
					await DefaultWait.sleep(DefaultWait.TimePeriod.MEDIUM);
				});

				it('Select ' + _mode.name, async function () {
					this.timeout(30000);

					const input = await Input.getInstance(DefaultWait.TimePeriod.DEFAULT);
					await input.setText(_mode.name);
					await input.selectQuickPick(_mode.label);
					// TODO: wait until integrations is started
					// Hint: use displayed status bar message containing 'Starting Camel K integration'
					await DefaultWait.sleep(DefaultWait.TimePeriod.MEDIUM);
				});

				it('Verify Apache Camel K integrations view', async function () {
					this.timeout(120000); // 2mins max

					const section = await new SideBarView().getContent().getSection('Apache Camel K Integrations') as CustomTreeSection;
					await section.expand();

					// wait until route is in state running
					await driver.wait(() => { return waitUntilIntegrationIsRunning(INTEGRATION_LABEL, section); }, 100000);

					// verify that started integration is properly running and visible inside Camel K integrations view
					const visibleItems = await section.getVisibleItems();
					assert.equal(await visibleItems[0].getText(), INTEGRATION_LABEL);
				});

				it('Follow log for running Apache Camel K integration', async function () {
					this.timeout(30000);

					const section = await new SideBarView().getContent().getSection('Apache Camel K Integrations') as CustomTreeSection;
					const item = await section.findItem(INTEGRATION_LABEL) as ViewItem;
					const menu = await item.openContextMenu();
					await menu.select('Follow log for running Apache Camel K Integration');
				});

				it('Verify running integration message inside log', async function () {
					this.timeout(120000); // 2min max

					const outputView = await OutputViewExt.open();
					const channelName = await outputView.getCurrentChannel();

					// verify that running integration is properly generating right message inside log
					assert.include(channelName, INTEGRATION_LABEL);
					await outputView.waitUntilContainsText(INTEGRATION_MESSAGE);
				});

				it('Stop running integration', async function () {
					this.timeout(60000);

					const section = await new SideBarView().getContent().getSection('Apache Camel K Integrations') as CustomTreeSection;
					await section.expand();
					const item = await section.findItem(INTEGRATION_LABEL) as ViewItem;
					const menu = await item.openContextMenu();
					await menu.select('Remove Apache Camel K Integration');
					// TODO: wait until status bar contains info "Removing integration..."
				});

				it('Verify integration was properly stopped and all stuff removed', async function () {
					this.timeout(60000);

					await DefaultWait.sleep(DefaultWait.TimePeriod.DEFAULT);

					// verify that output view of run integration was properly clenead
					const outputView = await OutputViewExt.open();
					await outputView.waitUntilContainsText(''); // wait until output view is empty
					assert.isEmpty(outputView.getText());

					// verify that followed integration channel was properly removed
					// TODO: wait until console contains text Removed Output channel for integration: inte-label-...
					const channelNames = await outputView.getChannelNames();
					channelNames.forEach(name => {
						assert.isNotTrue(name.startsWith(INTEGRATION_LABEL));
					});

					// verify that Camel K integrations view is empty - run integration was properly removed
					// todo: wait until integration is gone from Camel K view
					const section = await new SideBarView().getContent().getSection('Apache Camel K Integrations') as CustomTreeSection;
					const item = await section.findItem(INTEGRATION_LABEL) as ViewItem;
					assert.isUndefined(item);
				});
			});
		});

		async function waitUntilIntegrationIsRunning(integration: string, section: CustomTreeSection): Promise<boolean | undefined> {
			try {
				const item = await section.findItem(integration) as ViewItem;
				const title = await item.findElement(By.className('monaco-highlighted-label')).getAttribute('title');
				if (title.includes('Running')) {
					return true;
				}
				return false;
			} catch (err) {
				// do not print error
				return false;
			}
		}

		async function waitUntilIntegrationsIsDeleted(integration: string, section: CustomTreeSection): Promise<boolean | undefined> {
			try {
				const item = await section.findItem(integration) as ViewItem;
				if (item === undefined) {
					return true;
				}
				return false;
			} catch (err) {
				// do not print error
				return false;
			}
		}

		async function clearIntegrationsView(): Promise<boolean | undefined> {
			const section = await new SideBarView().getContent().getSection('Apache Camel K Integrations') as CustomTreeSection;
			await section.expand();
			// TODO: use refresh button or somehow reload view content
			await DefaultWait.sleep(DefaultWait.TimePeriod.SHORT);
			
			const visibleItems = await section.getVisibleItems();
			if (visibleItems.length > 0) {
				const label: string = await visibleItems[0].getText();
					
				const item = await section.findItem(label) as ViewItem;
				const menu = await item.openContextMenu();
				await menu.select('Remove Apache Camel K Integration');
				await driver.wait(() => { return waitUntilIntegrationsIsDeleted(label, section); }, DefaultWait.TimePeriod.LONG);
				return false;
			} else {
				return true;
			}
		}
	});
});
