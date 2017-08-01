const cheerio = require('cheerio');
const fs = require('fs');
const printf = require('printf');
const log = require('../libs/log');
const urlpool = require('../libs/urlpool');
const urlentity = require('../libs/urlentity');
const match = /(\S*):\/\/(\S*)/;

function fetchPage(container, html, urlkey, callback) {
    //to get the very begin company list info.
    //var fetch_file = './datas/' + home_url.match(match)[2] + '.' + key + ".result.json";
    var $ = cheerio.load(html);
    var page_node = $('.total.ng-binding');
    var no_result_node = $('.mt50.mb50.f14');
    var visit_denied_node = $('.module.module1.module2.loginmodule.collapse.in');
    if (page_node.is('div')) {
        //multi-pages.
        var page_count = page_node.text().match(/\d+/g)[0];//may not be exist.
        //https://www.tianyancha.com/search/p8?key=%E5%B7%A7%E8%BE%BE
        const url_match = /((http|https):\/\/)(\S*)p(\d+)(\S*)/;
        var url_template = '';
        var page_urls = $('.pagination-page.ng-scope').contents();
        page_urls.each(function () {
            var page_result = {};
            var page_url = $(this).attr('href');
            if (undefined == page_url)
                return;
            url_template = page_url;
            //stratgy,temporary fixed.
        });

        //put urls.
        //page_url.replace(url_match,'$3p88$5')
        container.user_data_ = new urlpool;
        var url_tl = url_template.match(url_match);
        var max_page = Math.min(5, page_count);
        for (var i = 2; i <= max_page; i++) {
            var page_url = url_template.replace(url_match, printf('$1$3p%d$5', i));
            container.user_data_.add(new urlentity(page_url, i, urlkey));
            //page1 will be fetched immediately.
        }
        if (callback)
            callback(page_count);
    } else if (visit_denied_node.is('div')) {
        if (callback)
            callback(-1);//denined.
    } else if (no_result_node.is('div')) {
        if (callback)
            callback(0);//search not found.
    } else {
        if (callback)
            callback(1);//only one page.
    }
}

function fetchBrief(container, export_datas, html, url_entity, callback, other) {
    //to get single page of the companies.
    //container will be put the detail urls in this page.
    var $ = cheerio.load(html);
    var page_data = {};
    page_data.index = url_entity.index_;
    page_data.url = url_entity.url_;
    page_data.key = url_entity.key_;
    page_data.timestamp = (new Date()).valueOf();
    page_data.datas = [];
    if (other) {
        for (var k in other)
            page_data[k] = other[k];
    }
    //https://www.tianyancha.com/company/832492421
    const company_id_matcher = /((http|https):\/\/)(\S*)\/(\d+)/;
    var ok = false;
    var contents = $('.search_result_single');
    var index = 1;
    contents.each(function () {
        ok = true;
        var data_result = {};
        var company_row = $(this)
            .children('.search_right_item')
            .children('.row.pb10');

        data_result['search_offset'] = (page_data.index - 1) * 20 + index++;

        data_result['company_detail_url'] = company_row
            .children('.col-xs-10')
            .children('a')
            .attr('href');
        var cdu = data_result['company_detail_url'];
        var detail_url = cdu ? cdu.match(company_id_matcher) : '';
        if (detail_url.length > 4) {
            data_result['company_id'] = detail_url[4];
            data_result['company_logo'] = $(this)
                .children('.mr20')
                .children('img')
                .attr('src');

            data_result['company_name'] = company_row
                .children('.col-xs-10')
                .children('a')
                .children('span')
                .text();

            data_result['company_city'] = company_row
                .children('.search_base')
                .contents().filter(function () {
                    return this.nodeType === 3;
                }).text().trim();

            var company_score = '';
            company_row.children('.search_base')
                .children('.notInIE8')
                .find('text')
                .each(function () {
                    company_score = ':' + $(this).text() + company_score
                });
            data_result['company_score'] = company_score.substr(1, company_score.length - 1);

            data_result['company_status'] = company_row
                .children('.search_base')
                .children('.position-abs')
                .contents().filter(function () {
                    return this.nodeType === 3;
                }).text().trim();

            var company_body_row = $(this)
                .children('.search_right_item')
                .children('.row')
                .children('.search_row_new');

            var company_body_content = company_body_row
                .children('.title');

            var company_body_ele = [];
            company_body_content.each(function () {
                var ele = $(this).contents().filter(function () {
                    return this.nodeType == 3
                }).text().trim();
                var val = $(this).find('span').text();
                company_body_ele.push(ele + val);
            });
            var comapny_short_name = company_body_row.children('div').find('.add').children('span').text().replace(/\s/g, "");
            company_body_ele.push(comapny_short_name);
            data_result['company_info'] = company_body_ele;
            page_data.datas.push(data_result);
            //put cache to the container.
            if (null == container.user_data_)
                container.user_data_ = new urlpool;
            //the next step will verified it whether the company and the company-details exist in db.
            container.user_data_.add({
                ue: new urlentity(
                    data_result['company_detail_url'],
                    data_result['search_offset'],
                    printf('%s.detail.%s.%s', page_data.key, data_result['company_id'], data_result['company_name'])),
                id: data_result['company_id'],
                name: data_result['company_name'],
                key: url_entity.key_,
                brief_exist: false,
                detail_exist: false
            }, false);
            if (index == contents.length + 1) {
                log._logR('fetching brief', 'succeed.', 'urls:', container.user_data_.size(), 'index:', page_data.index, page_data.url);
                if (callback) {
                    callback(true);//the visit may be rejected.
                }
            }
        }
    });
    if (!ok) {
        log._logR('fetching brief', 'failed. index:', page_data.index, page_data.url);
        if (callback) {
            callback(false);//the visit may be rejected.
        }
    }
}

function fetchDetail(container, export_datas, html, url_entity, callback) {
    var $ = cheerio.load(html);
    var detail_node_exist = $('.companyTitleBox55.pt20.pl30.pr30');
    var detail_node_notfound = $('.input-group.inputV2');
    var desc = {};
    desc.company_id = url_entity.key_.match(/(\S*)\.detail\.(\d+)\.(\S*)/)[2];
    if (detail_node_exist.is('div')) {

        //not write...
        // var url_file_name = './datas/' + url_entity.key_ + '.html';
        // var result_file_name = './datas/' + url_entity.key_ + '.json';
        // fs.writeFile(url_file_name, html, function (err) {
        //     if (err) throw err;
        //     log._logR('fetching detail', 'saving to', url_file_name);
        // });

        //富士康科技集团.detail.3071126383.广西富梦创新科技有限责任公司
        //save to db
        //others to be explain.
        container.explainer_.emitter_.dboperator_.insertCompanyPage(desc, html);
        log._logR('fetching detail', 'finished', url_entity.key_);
        if (callback) {
            callback(true);
        }
    } else if (detail_node_notfound.is('div')) {
        //this page is nolonger exit.
        container.explainer_.emitter_.dboperator_.updateCompanyUrlVerified(desc.company_id, 0);
        log._logR('fetching detail', 'page not exist', url_entity.key_);
        callback(true);//toggle to next.
    } else {
        if (callback) {
            callback(false);
        }
    }
}

module.exports = {
    fetchPage,
    fetchBrief,
    fetchDetail
}
