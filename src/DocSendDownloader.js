let connection;
let numSlides = parseInt((document.getElementsByClassName("page-label")[0].innerHTML).split(" ")[0]);
let baseUrl = window.location.href.split("?")[0];
let metadataEndpoint = baseUrl.charAt(baseUrl.length-1) == "/" ? baseUrl + "page_data/" : baseUrl + "/page_data/";
let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
let slideImageUrls = [];

let slideDeckAlreadyDownloaded = false; //cannot download the slide deck more than once on the same session
let slideDeckGenerationInProgress = false;

let userIsAuthenticated = () => {
    //If prompt doesn't exist, user has entered their email address to access slide deck.
    if (document.getElementById("prompt") == null) {
        return true; 
    } else {
        return false;
    }
}

let getSlideImageUrls = async () => {
    let timezoneOffset = new Date().getTimezoneOffset() * -60;
    let viewLoadTime = Math.floor(Date.now() / 1000);
    for(let i=1; i<=numSlides; i++) {
        let url = metadataEndpoint + String(i) + `?timezoneOffset=${timezoneOffset}&viewLoadTime=${viewLoadTime}`;
        let response = await fetch(url, {
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'x-csrf-token': csrfToken,
                'x-requested-with': 'XMLHttpRequest'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch page data for slide ${i}: ${response.status}`);
        }
        let data = await response.json();
        slideImageUrls.push(data.imageUrl);
    }
}

let generateSlideDeckPdf = async () => {
    try {
        await getSlideImageUrls();
        await buildPdf(slideImageUrls);
    } catch (e) {
        console.error("Error generating PDF:", e);
        slideDeckGenerationInProgress = false;
        slideDeckAlreadyDownloaded = false;
        hideCustomAlert();
        showDefaultAlert("Error generating PDF. Please reload the page and try again.");
    }
}

chrome.runtime.onConnect.addListener((port) => {
    connection = port;
    port.onMessage.addListener((message) => {
        if (userIsAuthenticated()) {
            if (message.requestType == "GENERATE_PDF") {
                slideDeckGenerationInProgress = true;
                slideDeckAlreadyDownloaded = true;
                showCustomAlert(`Generating slide deck as PDF: 0/${numSlides} slides complete...`);
                generateSlideDeckPdf();
            } 
            else if (message.requestType == "CHECK_PROGRESS") {
                if (slideDeckGenerationInProgress) {
                    showCustomAlert("Please wait. Still generating slide deck as PDF...");
                }
                else if (slideDeckAlreadyDownloaded) {
                    showDefaultAlert("Slide deck was already downloaded during this session. Please reload the page to download again.")
                } else {
                    showDefaultAlert("ERROR: Slide deck download progress unknown. Please try again.");
                }
            }
        } else {
            showDefaultAlert("You must be signed in to download this slide deck as a PDF.")
        }
    })
})


stream.on("finish", () => {
    slideDeckGenerationInProgress = false;
    let blobUrl = stream.toBlobURL('application/pdf');
    let totalTime = new Date().getTime() - startTime;
    initiateDownload(blobUrl);
    hideCustomAlert();
    showDefaultAlert("Done ! Slide deck PDF generated in " + String(totalTime) + " ms.");
    connection.postMessage({requestType: "SET_JOB_COMPLETE"});
})