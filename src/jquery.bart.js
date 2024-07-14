


(function($) {
    
    
    $.fn.bart = function( method ) {

        //generate a random number on page load
        const randomNumber = Math.floor(Math.random() * 3) + 1;

        // default options
        var opts = {
            balloon: {                       // default settings for a balloon
                earnings:        0.05,       // potential earnings for each pump
                popprob:         128,        // probability of popping (as 1 out of X)
                radius:          48,         // balloon size
                increment:       0.01,       // increment size of balloon at each pump
                color:           '#DA110D',  // color of balloon
                stroke_style:    '#000000',  // color of balloon stroke
                stroke_width:    3,          // width of balloon stroke
                gradient_radius: 3,          // relative size of gradient
                gradient_color:  '#E1E1E1',  // color of balloon gradient
                gradient_factor: 0.3,        // overlay factor of gradient
                width_factor:    0.03333,    //
                height_factor:   0.4,        //
                tie_width:       8,          // width of tie
                onstart: function() {},      // function to run on new balloon
                oninflate: function() {},    // function to run after inflation
                onexplode: function() {}     // function to run after explosion
            },
            bgcol:               '#FFF',     // background color for complete board
            w:                   600,        // width of board (in pixel)
            h:                   600,        // height of board (in pixel)
            showpumpcount: true,             // show number of pumps on board
            showballooncount:  true,         // show number of balloons on board
            showcurrentearned: true,         // show potential earnings on board
            showtotalearned: true,           // show total earnings on board
            showpopprob: false,              // show probability of explosion
            showpumpsused: false,            // show percentage of pumps used
            sounds: true,                    // play sounds
            earned: 0,                       // initial earnings
            sndpath: 'sounds/',              // path to sound files
            randomize:       true,           // randomize order of balloons
            frmid:           'bartdat',      // hidden form element to save all data to
            separator:       [':', ';'],     // value separators in hidden form field (0: within in balloon, 1: between ballons)
            frmids_pumps:    [],  // optional ids of hidden form elements to save 
                                             //    number of pumps for each balloon
            frmids_exploded: [],  // optional ids of hidden form elements to save 
                                             //    number of explosions for each balloon
            frmids_time:     [],             // optional ids of hidden form elements to save 
                                             //    mean latency between pumps (excluding time before first pump)
            txt_cashin: '$$ Cash in $$',     // text on 'Cash in' button
            txt_inflate: 'Inflate balloon',  // text on 'Inflate' button
            txt_next:    'Next balloon',     // text on 'Next' button
            txt_balloon_number: 'Balloon number: ',          // text for balloon number
            txt_number_of_pumps: 'Number of pumps: ',        // text for number of pumps
            txt_current_earned: 'Current earned: ',          // text for current earnings
            txt_total_earned: 'Total earned: ',              // text for total earnings
            txt_prob_explosion: 'Probability of explosion:', // text for probability of explosion
            txt_pumps_used: 'Max. available pumps used:',    // text for percentage of used pumps
            onload:    function() {},        // function to run before loading the script 
            onend:    function() {}          // function to run after finishing the last balloon 
        };
        
        var canvas = null, snds = {}, r = [];

        
        /****************************/
        // set user defined options //
        /****************************/
        
        var args = arguments[0] || {};
            
        // global settings
        opts = $.extend(true, opts, args.s || {});

        // create balloon definitions
        var bs = [];           // result set with balloons
        if($.type(args) == 'number' | $.type(args) == 'array') args = {b: args};
        if($.type(args.b) == 'number') {                            // number given 
            var bopts = $.extend(true, opts.balloon, args.o || {}); // default balloon settings
            for(var i = 1; i <= args.b; i++) {
                bs[i-1] = $.extend(true, {}, bopts);
                bs[i-1].id = i;
            }
        } else if($.type(args.b) == 'array') {                     // array of different balloon settings
            var bopts, cnt = 0;
            for(var i = 0; i < args.b.length; i++) { 
                if($.type(args.b[i]) == 'number') args.b[i] = {b: args.b[i]};
                if($.type(args.b[i].b) == 'number') {
                    bopts = $.extend(true, opts.balloon, args.b[i].o || {});
                    for(var j = 1; j <= args.b[i].b; j++) {
                        bs[cnt] = $.extend(true, {}, bopts);
                        bs[cnt].id = cnt+1;
                        cnt++;
                    }
                }
            }
        } else {
            alert('Configuration error: No balloon definitions! Aborting.');
            return this;
        }
        if(opts.randomize) bs.sort(randOrder);
   
        
        /****************************/
        // set up form ids          //
        /****************************/
        
        for(var i = 0; i < bs.length; i++) {
            if(opts.frmids_pumps[i] === undefined) opts.frmids_pumps[i] = 'BARTpumps'+(i+1);
            if(opts.frmids_exploded[i] === undefined) opts.frmids_exploded[i] = 'BARTexploded'+(i+1);
            if(opts.frmids_time[i] === undefined) opts.frmids_time[i] = 'BARTtime'+(i+1);
        }
        
        
        /****************************/
        // buffer sounds            //
        /****************************/
        
        if(opts.sounds == true) {
            if((new Audio()).canPlayType('audio/mpeg') != "") {   // mp3 for IE
                snds.inflate = (new Audio(opts.sndpath + ''));
                snds.explode = (new Audio(opts.sndpath + ''));
                snds.cashin = (new Audio(opts.sndpath + ''));
            } else if((new Audio()).canPlayType('audio/x-wav')) { // wav for the rest
                snds.inflate = (new Audio(opts.sndpath + ''));
                snds.explode = (new Audio(opts.sndpath + ''));
                snds.cashin = (new Audio(opts.sndpath + ''));
            }
        }
 
        
        /**
         * Create a new Balloon
         *
         * @param   Object  settings for balloon
         */
        balloon = function(s) {
            
            s = $.extend(true, opts.balloon, s || {});
            s.pumps = -1;
            s.exploded = false;
            s.earned = 0;
            s.popseq = [];
            s.time = [];
            for (var i=1; i <= s.popprob; i++) s.popseq.push(i);
            s.popseq.sort(randOrder);               // randomized
                
            // apply settings to object
            var me = this;
            $.each(s, function(k,v) { me[[k]] = v; });
            
            // on balloon hook
            this.onstart();
            
        }
        
        
        /**
         * Inflate the balloon 
         *
         * @param   Object      jQuery canvas object to draw on
         * @author              Logan Franken & Timo Gnambs
         * @source              adapted from http://www.loganfranken.com/blog/64/html5-canvas-balloon/
         */
        balloon.prototype.inflate = function(canvas) {
            
            // center of canvas
            var centerX = (canvas.width() - 200) / 2;
            var centerY = canvas.height() / 2 - (this.radius+this.radius * this.height_factor)/4;
            
            // degree of curving
            var handleLength = (4 * (Math.sqrt(2) - 1))/3 * this.radius;
            
            // bottom Y of balloon
            var balloonBottomY = centerY + this.radius + (this.radius * this.height_factor);

            // remove existing balloon
            canvas.removeLayerGroup('balloon').drawLayers();

            // draw tie as triangle
            canvas.drawPolygon({ strokeStyle: this.stroke_style, 
                                 strokeWidth: this.stroke_width, 
                                 fillStyle: this.color,
                                 x: centerX,
                                 y: balloonBottomY + (this.tie_width / 2), 
                                 radius: this.tie_width, 
                                 sides: 3,
                                 layer: true,
                                 name: 'tie',
                                 groups: ['balloon'] });
                                 
            // create color gradient for balloon
            var grad = canvas.createGradient({ x1: centerX + (this.radius/this.gradient_radius), 
                                               y1: centerY - (this.radius/this.gradient_radius),
                                               r1: this.gradient_radius, 
                                               r2: this.radius + (this.radius * this.height_factor), 
                                               x2: centerX, 
                                               y2: centerY,
                                               c1: this.gradient_color,
                                               c2: this.color, 
                                               s2: this.gradient_factor });

            // draw balloon
            canvas.drawBezier({ strokeStyle: this.stroke_style, 
                                strokeWidth: this.stroke_width, 
                                fillStyle: grad,
                                x1:  centerX - this.radius,  // start of top left curve
                                y1:  centerY,
                                cx1: centerX - this.radius,  // top left curving
                                cy1: centerY - handleLength - (this.radius * this.width_factor),
                                cx2: centerX - handleLength,
                                cy2: centerY - this.radius,
                                x2:  centerX,                // end of top left curve
                                y2:  centerY - this.radius,
                                cx3: centerX + handleLength + (this.radius * this.width_factor), // top right curving
                                cy3: centerY - this.radius,
                                cx4: centerX + this.radius, 
                                cy4: centerY - handleLength,
                                x3:  centerX + this.radius,  // end of top right curve
                                y3:  centerY,
                                cx5: centerX + this.radius,  // bottom right curving
                                cy5: centerY + handleLength,
                                cx6: centerX + handleLength, 
                                cy6: balloonBottomY,
                                x4:  centerX,                // end of bottom right curve
                                y4:  balloonBottomY,
                                cx7: centerX - handleLength, // bottom left curving
                                cy7: balloonBottomY,
                                cx8: centerX - this.radius, 
                                cy8: centerY + handleLength,
                                x5:  centerX - this.radius,  // end of bottom left curve
                                y5:  centerY,
                                layer: true,
                                name: 'bubble', 
                                groups: ['balloon'] });
            
            // increase number of pumps
            this.pumps = this.pumps + 1;
        
            // calculate current earnings
            this.earned = (new Number(this.pumps * this.earnings)).toFixed(2);
            
            // add time stamp of pump
            this.time.push($.now());
                                
            // // sound
            // if(opts.sounds == true & this.pumps > 0) {
            //     if((new Audio()).canPlayType("audio/mpeg") != "") {   // mp3 for IE
            //         (new Audio(opts.sndpath + 'inflate.mp3')).play();
            //     } else if((new Audio()).canPlayType("audio/x-wav")) { // wav for the rest
            //         (new Audio(opts.sndpath + 'inflate.wav')).play();
            //     }
            // }

            //play background music if the random number is even and different if odd
            // if (randomNumber == 1) {
            //     var audio = new Audio(opts.sndpath + 'back-audio-1.wav');
            //     audio.play();
            // } else if (randomNumber == 2) {
            //     var audio = new Audio(opts.sndpath + 'back-audio-2.wav');
            //     audio.play();
            // }
            
            // on inflate hook
            this.oninflate();
            
        }
        
        
        /**
         * Explode the balloon
         *
         * @param   Object      jQuery canvas object to draw on
         */
        balloon.prototype.explode = function(canvas) {
            
            // remove balloon
            canvas.removeLayerGroup('balloon').drawLayers();

            // create a new overlay animation and make it first child of the bart and make sure its above the canvas
            const bart = document.getElementById('bart');
            const overlay = document.createElement('div');
            overlay.id = 'overlay';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.zIndex = '100';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            bart.insertBefore(overlay, bart.firstChild);

            lottie.loadAnimation({
                container: overlay, // Replace with your container ID
                renderer: 'svg',
                loop: false,
                autoplay: true,
                path: 'src/anim.json' // Replace with the path to your Lottie JSON file
              });

            // remove overlay after 2 seconds
            setTimeout(() => {
                bart.removeChild(overlay);
            }, 2000);
              
            
            // sound
            if(opts.sounds == true) {
                snds.explode.play();
            }
            
            // set explosion state
            this.exploded = true;
            
            // increase number of pumps
            this.pumps = this.pumps + 1;
            
            // current earnings
            this.earned = 0;

            // add time stamp of pump
            this.time.push($.now());
            
            // save results
            this.save();
            
            // on explode hook
            this.onexplode();
            
        }
                
        /**
         * Save results
         */
        balloon.prototype.save = function() {
            
            // individual result string
            $('#' + opts.frmids_pumps[this.id-1]).attr( { value: this.pumps } );
            $('#' + opts.frmids_exploded[this.id-1]).attr( { value: (this.exploded)*1 } );
            for(var i = 1, t = 0; i < this.time.length; i ++)  t += this.time[i] - this.time[i-1];
            if(this.pumps > 1) t = Math.round(t / (this.pumps-1));
            else t = -9;            
            $('#' + opts.frmids_time[this.id-1]).attr( { value: t });
            
            // complete result string
            var r = $('#' + opts.frmid).val();
            r = r + ([this.id, this.pumps, (this.exploded)*1, t]).join(opts.separator[0]);
            r = r +  opts.separator[1];
            $('#' + opts.frmid).val(r);
        }
        
        
        /**
         * Return a random number to sort an array randomly
         *
         * @return int
         */
        function randOrder () {
            return (Math.round(Math.random())-0.5);
        }
        
        
        return this.first().each(function() {
                
            // on load hook
            opts.onload();
                
            // set up html structure 
            $(this)
                .css({                       // wrapper
                    width:              opts.w + 'px',                         
                    height:             opts.h + 'px',
                    'background-color': opts.bgcol,
                    overflow:           'hidden'
                });
            canvas = $('<canvas>')
                .attr({   // canvas
                    width:  opts.w + 'px',       
                    height: opts.h - 100 + 'px',
                    margin: 0 
                })
                .css({ 
                    'background-color': opts.bgcol 
                })
                .appendTo(this);
            var divBottom = $('<div>').addClass('BARTbottom');  // footer
            divBottom
                .css({ 
                    width:  opts.w + 'px', 
                    height: '100px' })
                .appendTo(this);
            
            // create hidden form fields for all response data
            $('<input>').attr({ type: 'hidden',
                                value: '',
                                id:    opts.frmid,
                                name:  opts.frmid 
                        })
                        .insertAfter(canvas);
            
            // create hidden form fields for number of pumps (one for each balloon)
            $.each(opts.frmids_pumps, function(i,j) {
                $('<input>').attr({ type: 'hidden',
                                    value: '0',
                                    id:    j,
                                    name:  j 
                            })
                            .insertAfter(canvas);
            });
            
            // create hidden form fields for number of explosions (one for each balloon)
            $.each(opts.frmids_exploded, function(i,j) {
                $('<input>').attr({ type: 'hidden',
                                    value: '0',
                                    id:    j,
                                    name:  j 
                            })
                            .insertAfter(canvas);
            });
            
            // create hidden form fields for reaction time (one for each balloon)
            $.each(opts.frmids_time, function(i,j) {
                $('<input>').attr({ type: 'hidden',
                                    value: '0',
                                    id:    j,
                                    name:  j 
                            })
                            .insertAfter(canvas);
            });
        
            // number of balloons
            if(opts.showballooncount == true) {
                canvas.drawText({
                    x:         opts.w - 150,
                    y:         50,
                    layer:     true,
                    name:      'balnum',
                    fillStyle: '#000',
                    font:      '14pt Verdana, sans-serif',
                    text:      opts.txt_balloon_number + ' 1 / ' + bs.length
                });
            }
                
            // total earnings
            var bottomY = opts.h - 200;
            if(opts.showtotalearned == true) {
                canvas.drawText({
                    x:         opts.w - 150,
                    y:         bottomY,
                    layer:     true,
                    name:      'totearn',
                    fillStyle: '#000',
                    font:      '14pt Verdana, sans-serif',
                    text:      opts.txt_total_earned + '0.00'
                });
                bottomY -= 50;
            }
                
            // number of pumps
            if(opts.showpumpcount == true) {
                canvas.drawText({
                    x:         opts.w - 150,
                    y:         bottomY,
                    layer:     true,
                    name:      'pumpnum',
                    fillStyle: '#000',
                    font:      '14pt Verdana, sans-serif',
                    text:      opts.txt_number_of_pumps + '0'
                });
                bottomY -= 50;
            }
                
            // current earnings
            if(opts.showcurrentearned == true) {
                canvas.drawText({
                    x:         opts.w - 150,
                    y:         bottomY,
                    layer:     true,
                    name:      'curearn',
                    fillStyle: '#000',
                    font:      '14pt Verdana, sans-serif',
                    text:      opts.txt_current_earned + '0.00'
                });
            }

            // probability of explosion
            if(opts.showpopprob == true) {
                canvas.drawText({
                    x:         opts.w - 150,
                    y:         200,
                    layer:     true,
                    name:      'popprob',
                    fillStyle: '#000',
                    font:      '14pt Verdana, sans-serif',
                    text:      opts.txt_prob_explosion + "\n\n" + 
                               (new Number(Math.round(10000/bs[0].popprob)/100)).toFixed(2) + '%'
                });
            }
            
            // available pumps used
            if(opts.showpumpsused == true) {
                canvas.drawText({
                    x:         opts.w - 150,
                    y:         200,
                    layer:     true,
                    name:      'pumuse',
                    fillStyle: '#000',
                    font:      '14pt Verdana, sans-serif',
                    text:      opts.txt_pumps_used + "\n\n" + '0%'
                });
            }
               
            // inflate balloon button
            var butInflate = $('<input>')
                .addClass('BARTinflate')
                .appendTo(divBottom)
                .attr({
                    value: opts.txt_inflate, 
                    type: 'button'
                })
                .css({ 
                    width:  '200px',
                    height: '90px',
                    margin: '0 20px' 
                })
                .on('click.bart', function(e) {
                        
                    // check for explosion
                    bal.popseq.sort(randOrder);
                    if(bal.popseq.shift() == 1) {
                    
                        // explode balloon
                        bal.explode(canvas);
                            
                        // show/hide buttons
                        butInflate.hide();
                        butCashin.hide();
                        if(balcnt+1 < bs.length) butNext.show();
                        else opts.onend();
                            
                        
                    } else {
                        
                        // inflate balloon
                        bal.radius = bal.radius * (1 + bal.increment);
                        bal.tie_width = bal.tie_width * (1 + bal.increment);
                        bal.inflate(canvas);    
                            
                    }
                        
                    // update counts
                    if(opts.showpumpcount) {
                        canvas.setLayer('pumpnum', { text: opts.txt_number_of_pumps + bal.pumps });
                    }
                    if(opts.showcurrentearned) {
                        canvas.setLayer('curearn', { text: opts.txt_current_earned + 
                                                            (new Number(bal.earned)).toFixed(2) });
                    }
                    if(opts.showpopprob) {
                        canvas.setLayer('popprob', { text: opts.txt_prob_explosion + "\n\n" + 
                                                          (new Number(Math.round(10000/bal.popseq.length)/100)).toFixed(2) + '%' });
                    }
                    if(opts.showpumpsused) {
                        canvas.setLayer('pumuse', { text: opts.txt_pumps_used + "\n\n" + 
                                                          (Math.round((bal.popprob-bal.popseq.length)/bal.popprob*100)) + '%' });
                    }
                    if(opts.showpumpcount | opts.showcurrentearned | opts.showpopprob | opts.showpumpsused) {
                        canvas.drawLayers();
                    }
                
                });
                
            // next in button
            var butNext = $('<input>')
                .addClass('BARTnext')
                .appendTo(divBottom)
                .attr({ 
                    value:   opts.txt_next, 
                    type:    'button'
                })
                .css({ 
                    width:  '200px',
                    height: '90px',
                    margin: '0 20px' 
                })
                .hide()
                .on('click.bart', function(e) {
                        
                // next ballon
                balcnt++;
                bal = new balloon( bs[balcnt] );
                bal.inflate(canvas);
                        
                // update counts
                if(opts.showpumpcount) {
                    canvas.setLayer('pumpnum', { text: opts.txt_number_of_pumps + '0' });
                }
                if(opts.showcurrentearned) {
                    canvas.setLayer('curearn', { text: opts.txt_current_earned + '0.00' });
                }
                if(opts.showballooncount) {
                    canvas.setLayer('balnum', { text: opts.txt_balloon_number + 
                                                        (balcnt+1) + ' / ' + bs.length });
                }
                if(opts.showpopprob) {
                    canvas.setLayer('popprob', { text: opts.txt_prob_explosion + "\n\n" + 
                                                       (new Number(Math.round(10000/bs[balcnt].popprob)/100)).toFixed(2) + '%' });
                }
                if(opts.showpumpsused) {
                    canvas.setLayer('pumpuse', { text: opts.txt_pumps_used + "\n\n" + '0%' });
                }
                if(opts.showpumpcount | opts.showcurrentearned | opts.showballooncount | opts.showpopprob | opts.showpumpsused) {
                    canvas.drawLayers();
                }
                            
                // show/hide buttons
                butInflate.show();
                butCashin.show();
                butNext.hide();
                
            });
                                                  
            // cash in button
            var butCashin = $('<input>')
                .addClass('BARTcashin')
                .appendTo(divBottom)
                .attr({ 
                    value: opts.txt_cashin, 
                    type:  'button'
                })
                .css({
                    width:  '200px',
                    height: '90px',
                    margin: '0 20px' 
                })
                .on('click.bart', function(e) {
                       
                    // update counts
                    opts.earned = (opts.earned*1 + bal.earned*1).toFixed(2);
                    if(opts.showtotalearned) {
                        canvas.setLayer('totearn', { text: opts.txt_total_earned + opts.earned }).drawLayers();
                    }
                        
                    // show/hide buttons
                    butInflate.hide();
                    butCashin.hide();
                    bal.save();
                    if(balcnt+1 < bs.length) butNext.show();
                    else opts.onend();
                        
                    // sound
                    if(opts.sounds == true) {
                        snds.cashin.play();
                    }
                        
                });
                
                
                // draw first ballon
                var balcnt = 0;
                bal = new balloon( bs[0] );
                bal.inflate(canvas);
                    
            });   
            
        };
    
})(jQuery);
