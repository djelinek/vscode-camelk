import { SideBarView, ViewItem, CustomTreeSection, By, WebDriver, VSBrowser, WebElement, EditorView, WebView } from 'vscode-extension-tester';
import { Dialog, Input, OutputViewExt, DefaultWait } from 'vscode-uitests-tooling';
import * as path from 'path';
import { assert } from 'chai';

describe('Start Camel K integration in Dev Mode and Basic', function () {

	let driver: WebDriver;

	const RESOURCES: string = path.resolve('src', 'ui-test', 'resources');
	const INTEGRATION_MESSAGE: string = 'Hello uitests!';

	const integrations: string[] = [
        // 'groovy-example.groovy', 'JavaExample.java', 'js-example.js', 'kotlin-example.kts', 'xml-example.xml'
        'xml-example.xml'
	];

	before(async function () {
		this.timeout(300000); // 5 minutes
        driver = VSBrowser.instance.driver;

        // need to wait for finishing of dependencies (kamel, kubectl) installation
        try {
            await DefaultWait.sleep(DefaultWait.TimePeriod.DEFAULT); // wait for 5s if downloading will start or not
            const downloadBar = await driver.findElement(By.id('redhat.vscode-camelk'));
            await driver.wait(() => { return waitForAttributeValueContains(downloadBar, 'aria-label', 'Download progress'); }, 240000);
           
            await DefaultWait.sleep(DefaultWait.TimePeriod.DEFAULT); // wait for another 5s if second downloading will start or not
            const downloadBarr = await driver.findElement(By.id('redhat.vscode-camelk'));
            await driver.wait(() => { return waitForAttributeValueContains(downloadBarr, 'aria-label', 'Download progress'); }, 240000);
        } catch (error) {
            // no fail, kamel and kubectl are probably already installed
            console.log(error.name + ' - ' + error.message);
        }
        
        await Dialog.openFolder(RESOURCES);
        await DefaultWait.sleep(DefaultWait.TimePeriod.MEDIUM); // wait another 3s to ensure folder is properly opened
    });
    
    describe('Dev Mode', function () { 

        const MODE_NAME: string = 'Dev Mode';
        const MODE_LABEL: string = 'Dev Mode - Apache Camel K Integration in Dev Mode';
        
        integrations.forEach(function (_integration) {
			testSuite(_integration, MODE_NAME, MODE_LABEL);
        });
    });

    // describe('Basic', function () { 

    //     const MODE_NAME: string = 'Basic';
    //     const MODE_LABEL: string = 'Basic - Apache Camel K Integration (no ConfigMap or Secret)';
        
    //     integrations.forEach(function (_integration) {
	// 		testSuite(_integration, MODE_NAME, MODE_LABEL);
    //     });
    // });
    
    async function testSuite(_integration: string, _modeName: string, _modeLabel: string) {

        describe('Integration - ' + _integration + ', ' + _modeName, function () {

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
                this.timeout(100000);

                const viewSection = await new SideBarView().getContent().getSection('resources');
                const item = await viewSection.findItem(_integration) as ViewItem;
                const menu = await item.openContextMenu();
                await menu.select('Start Apache Camel K Integration');
                // TODO: wait until command palette is displayed
                await DefaultWait.sleep(DefaultWait.TimePeriod.DEFAULT);
            });

            it('Select ' + _modeName, async function () {
                this.timeout(30000);

                const input = await Input.getInstance(DefaultWait.TimePeriod.DEFAULT);
                await input.setText(_modeName);
                await input.selectQuickPick(_modeLabel);
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
                // verify that running integration is properly generating right message inside log
                if(_modeName == 'Dev Mode') {
                    await outputView.waitUntilContainsText(INTEGRATION_MESSAGE);
                } else {
                    const webview = new WebView(new EditorView(), 'Logs - default/custom/' + INTEGRATION_LABEL);
                    
                    await webview.switchToFrame();

                    console.log(webview);

                    const element = await webview.findWebElement(By.partialLinkText('Hello uitests!'));
                    const text = await element.getText();
                    console.log(text);
                    

                    await webview.switchBack();
                }
                
                // const channelName = await outputView.getCurrentChannel();
                // assert.include(channelName, INTEGRATION_LABEL);
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

                // verify that output view of run integration was properly clenead out
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
    }

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

    async function waitForAttributeValueContains(element: WebElement, attribute: string, value: string) {
        try {
            const result = await element.getAttribute(attribute);
            console.log(result);
            console.log(!result.includes(value));
            return !result.includes(value);
        } catch (error) {
            console.log(error.name);
            if(error.name === 'StaleElementReferenceError') {
                return true;
            }
        }
    }
});
