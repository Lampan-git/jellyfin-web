import dom from 'dom';
import playbackManager from 'playbackManager';
import connectionManager from 'connectionManager';
import events from 'events';
import mediaInfo from 'mediaInfo';
import layoutManager from 'layoutManager';
import focusManager from 'focusManager';
import globalize from 'globalize';
import itemHelper from 'itemHelper';
import 'css!./upnextdialog';
import 'emby-button';
import 'flexStyles';

/* eslint-disable indent */

    const transitionEndEventName = dom.whichTransitionEvent();

    function seriesImageUrl(item, options) {
        if (item.Type !== 'Episode') {
            return null;
        }

        options = options || {};
        options.type = options.type || 'Primary';

        if (options.type === 'Primary') {
            if (item.SeriesPrimaryImageTag) {
                options.tag = item.SeriesPrimaryImageTag;

                return connectionManager.getApiClient(item.ServerId).getScaledImageUrl(item.SeriesId, options);
            }
        }

        if (options.type === 'Thumb') {
            if (item.SeriesThumbImageTag) {
                options.tag = item.SeriesThumbImageTag;

                return connectionManager.getApiClient(item.ServerId).getScaledImageUrl(item.SeriesId, options);
            }
            if (item.ParentThumbImageTag) {
                options.tag = item.ParentThumbImageTag;

                return connectionManager.getApiClient(item.ServerId).getScaledImageUrl(item.ParentThumbItemId, options);
            }
        }

        return null;
    }

    function imageUrl(item, options) {
        options = options || {};
        options.type = options.type || 'Primary';

        if (item.ImageTags && item.ImageTags[options.type]) {
            options.tag = item.ImageTags[options.type];
            return connectionManager.getApiClient(item.ServerId).getScaledImageUrl(item.PrimaryImageItemId || item.Id, options);
        }

        if (options.type === 'Primary') {
            if (item.AlbumId && item.AlbumPrimaryImageTag) {
                options.tag = item.AlbumPrimaryImageTag;
                return connectionManager.getApiClient(item.ServerId).getScaledImageUrl(item.AlbumId, options);
            }
        }

        return null;
    }

    function setPoster(osdPoster, item, secondaryItem) {
        if (item) {
            let imgUrl = seriesImageUrl(item, { type: 'Primary' }) ||
                seriesImageUrl(item, { type: 'Thumb' }) ||
                imageUrl(item, { type: 'Primary' });

            if (!imgUrl && secondaryItem) {
                imgUrl = seriesImageUrl(secondaryItem, { type: 'Primary' }) ||
                    seriesImageUrl(secondaryItem, { type: 'Thumb' }) ||
                    imageUrl(secondaryItem, { type: 'Primary' });
            }

            if (imgUrl) {
                osdPoster.innerHTML = '<img class="upNextDialog-poster-img" src="' + imgUrl + '" />';
                return;
            }
        }

        osdPoster.innerHTML = '';
    }

    function getHtml() {
        let html = '';

        html += '<div class="upNextDialog-poster">';
        html += '</div>';

        html += '<div class="flex flex-direction-column flex-grow">';

        html += '<h2 class="upNextDialog-nextVideoText" style="margin:.25em 0;">&nbsp;</h2>';

        html += '<h3 class="upNextDialog-title" style="margin:.25em 0 .5em;"></h3>';

        html += '<div class="flex flex-direction-row upNextDialog-mediainfo">';
        html += '</div>';

        html += '<div class="upNextDialog-overview" style="margin-top:1em;"></div>';

        html += '<div class="flex flex-direction-row upNextDialog-buttons" style="margin-top:1em;">';

        html += '<button type="button" is="emby-button" class="raised raised-mini btnStartNow upNextDialog-button">';
        html += globalize.translate('HeaderStartNow');
        html += '</button>';

        html += '<button type="button" is="emby-button" class="raised raised-mini btnHide upNextDialog-button">';
        html += globalize.translate('Hide');
        html += '</button>';

        // buttons
        html += '</div>';

        // main
        html += '</div>';

        return html;
    }

    function setNextVideoText() {
        const instance = this;

        const elem = instance.options.parent;

        const secondsRemaining = Math.max(Math.round(getTimeRemainingMs(instance) / 1000), 0);

        console.debug('up next seconds remaining: ' + secondsRemaining);

        const timeText = '<span class="upNextDialog-countdownText">' + globalize.translate('HeaderSecondsValue', secondsRemaining) + '</span>';

        const nextVideoText = instance.itemType === 'Episode' ?
            globalize.translate('HeaderNextEpisodePlayingInValue', timeText) :
            globalize.translate('HeaderNextVideoPlayingInValue', timeText);

        elem.querySelector('.upNextDialog-nextVideoText').innerHTML = nextVideoText;
    }

    function fillItem(item) {
        const instance = this;

        const elem = instance.options.parent;

        setPoster(elem.querySelector('.upNextDialog-poster'), item);

        elem.querySelector('.upNextDialog-overview').innerHTML = item.Overview || '';

        elem.querySelector('.upNextDialog-mediainfo').innerHTML = mediaInfo.getPrimaryMediaInfoHtml(item, {
        });

        let title = itemHelper.getDisplayName(item);
        if (item.SeriesName) {
            title = item.SeriesName + ' - ' + title;
        }

        elem.querySelector('.upNextDialog-title').innerHTML = title || '';

        instance.itemType = item.Type;

        instance.show();
    }

    function clearCountdownTextTimeout(instance) {
        if (instance._countdownTextTimeout) {
            clearInterval(instance._countdownTextTimeout);
            instance._countdownTextTimeout = null;
        }
    }

    function onStartNowClick() {
        const options = this.options;

        if (options) {
            const player = options.player;

            this.hide();

            playbackManager.nextTrack(player);
        }
    }

    function init(instance, options) {
        options.parent.innerHTML = getHtml();

        options.parent.classList.add('hide');
        options.parent.classList.add('upNextDialog');
        options.parent.classList.add('upNextDialog-hidden');

        fillItem.call(instance, options.nextItem);

        options.parent.querySelector('.btnHide').addEventListener('click', instance.hide.bind(instance));
        options.parent.querySelector('.btnStartNow').addEventListener('click', onStartNowClick.bind(instance));
    }

    function clearHideAnimationEventListeners(instance, elem) {
        const fn = instance._onHideAnimationComplete;

        if (fn) {
            dom.removeEventListener(elem, transitionEndEventName, fn, {
                once: true
            });
        }
    }

    function onHideAnimationComplete(e) {
        const instance = this;
        const elem = e.target;

        elem.classList.add('hide');

        clearHideAnimationEventListeners(instance, elem);
        events.trigger(instance, 'hide');
    }

    function hideComingUpNext() {
        const instance = this;
        clearCountdownTextTimeout(this);

        if (!instance.options) {
            return;
        }

        const elem = instance.options.parent;

        if (!elem) {
            return;
        }

        clearHideAnimationEventListeners(this, elem);

        if (elem.classList.contains('upNextDialog-hidden')) {
            return;
        }

        // trigger a reflow to force it to animate again
        void elem.offsetWidth;

        elem.classList.add('upNextDialog-hidden');

        const fn = onHideAnimationComplete.bind(instance);
        instance._onHideAnimationComplete = fn;

        dom.addEventListener(elem, transitionEndEventName, fn, {
            once: true
        });
    }

    function getTimeRemainingMs(instance) {
        const options = instance.options;
        if (options) {
            const runtimeTicks = playbackManager.duration(options.player);

            if (runtimeTicks) {
                const timeRemainingTicks = runtimeTicks - playbackManager.currentTime(options.player);

                return Math.round(timeRemainingTicks / 10000);
            }
        }

        return 0;
    }

    function startComingUpNextHideTimer(instance) {
        const timeRemainingMs = getTimeRemainingMs(instance);

        if (timeRemainingMs <= 0) {
            return;
        }

        setNextVideoText.call(instance);
        clearCountdownTextTimeout(instance);

        instance._countdownTextTimeout = setInterval(setNextVideoText.bind(instance), 400);
    }

class UpNextDialog {
    constructor(options) {
        this.options = options;

        init(this, options);
    }
    show() {
        const elem = this.options.parent;

        clearHideAnimationEventListeners(this, elem);

        elem.classList.remove('hide');

        // trigger a reflow to force it to animate again
        void elem.offsetWidth;

        elem.classList.remove('upNextDialog-hidden');

        if (layoutManager.tv) {
            setTimeout(function () {
                focusManager.focus(elem.querySelector('.btnStartNow'));
            }, 50);
        }

        startComingUpNextHideTimer(this);
    }
    hide() {
        hideComingUpNext.call(this);
    }
    destroy() {
        hideComingUpNext.call(this);

        this.options = null;
        this.itemType = null;
    }
}

export default UpNextDialog;

/* eslint-enable indent */
