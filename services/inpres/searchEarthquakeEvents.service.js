import browser from '../../utils/Browser.js';

export async function searchEarthquakeEvents({ fromDate, toDate }) {
    let page = null;

    try {
        const URL = 'http://contenidos.inpres.gob.ar/buscar_sismo';
        page = await browser.CreatePage(URL, { waitUntil: 'domcontentloaded' });

        await page.evaluate((fromDate, toDate) => {
            const fromDateInput = document.querySelector('#datepicker');
            const toDateInput = document.querySelector('#datepicker2');
            const checkInput = document.querySelector('#tilde1');

            if(checkInput) checkInput.click();

            if(fromDateInput && toDateInput) {
                fromDateInput.value = fromDate;
                toDateInput.value = toDate;

                const searchButton = document.querySelector('#boton');

                if(searchButton) searchButton.click();
            }
        }, fromDate, toDate);

        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('body > table:nth-child(4) > tbody > tr > td > table:nth-child(3)');

        // log the url page
        let url = page.url();
        
        const result = await page.evaluate(() => {
            const pagination = document.querySelector('body > table:nth-child(4) > tbody > tr > td > table:nth-child(3)');
            let quantityTxt = document.querySelector('#sismos > tbody > tr:nth-child(1) > td');

            if(pagination && quantityTxt) {
                const pages = pagination.querySelectorAll('a');
                quantityTxt = quantityTxt.innerText;

                if(quantityTxt.split(' ').length > 1) {
                    let quantity = quantityTxt.split(' ')[0];

                    if(quantity.includes('sísmos') && (/\d/g).test(quantity[0])){
                        return { pages: pages.length, quantity: parseInt(quantity[0].match(/\d/g).join('')) };
                    }
                }

                return { error: true, status: 500, data: pagination, message: 'No se encontro el selector para cantidad de resultados' };
            }
            else {
                return { error: true, status: 500, data: pagination, message: 'No se encontro el selector de paginacion o cantidad de resultados' };
            }            
        });

        if(result.error) return result;

        const events = [];

        for(let i = 1; i <= result.pages; i++) {
            const tableRows = await getTableRowsData(page);
            events.push(...tableRows);

            if(i < result.pages) {
                await page.goto(`http://contenidos.inpres.gob.ar/sismos_consultados.php?pagina=${i + 1}&totpag=${result.pages}&ctd=${result.quantity}`, { waitUntil: 'domcontentloaded' });
            }
        }

        return { error: false, data: events };            
    } 
    catch (error) {
        console.error(error);
        return { error: true, status: 500, data: error.message, message: 'Error en la petición' };
    }
}

const getTableRowsData = async (page) => {
    const events = await page.evaluate(() => {
        const events = [];
        const table = document.querySelector('#sismos');

        if(table) {
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, i) => {
                const cells = row.querySelectorAll('td');

                if (cells.length < 9 || i < 2) return;

                const event = {
                    id: cells[0].textContent.trim(),
                    date: cells[1].textContent.trim(),
                    time: cells[2].textContent.trim(),                        
                    lat: cells[3].textContent.trim(),
                    long: cells[4].textContent.trim(),
                    depth: cells[5].textContent.trim(),
                    magnitude: cells[6].textContent.trim(),
                    intensity: cells[7].textContent.trim(),
                    place: cells[8].textContent.trim()
                };
                events.push(event);
            });
        }

        return events;
    });

    return events;
};
