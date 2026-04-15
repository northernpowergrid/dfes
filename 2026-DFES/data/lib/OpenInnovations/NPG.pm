package OpenInnovations::NPG;

use strict;
use warnings;
use Data::Dumper;
use OpenInnovations::Colour;


sub new {
    my ($class, %args) = @_;
 
    my $self = \%args;
 
    bless $self, $class;
	
	$self->{'flexible'} = "(without customer flexibility|ToUT)";
 
    return $self;
}

# Load in a CSV file
sub load {
	my ($self, $file) = @_;
	my ($str,@lines,$i,$c,@header,%headers,%cols,@rows);

	if(-e $file){
		# Get a local file
		open(FILE,$file);
		@lines = <FILE>;
		close(FILE);
	}elsif($file =~ /^https?\:/){
		# Get a remote file
		@lines = `wget -q --no-check-certificate -O- "$file"`;
	}else{
		print "ERROR: No file provided ($file).\n";
		return $self;
	}
	$self->{'file'} = $file;
	$self->{'data'} = \@lines;

	return $self;
}

# Set the properties of the scenarios
sub setScenarios {
	my ($self, %scenarios) = @_;
	$self->{'scenario-props'} = \%scenarios;	
	return $self;
}

sub process {
	my ($self) = @_;
	my(@lines,@header,$c,%headers,$i,@cols,$maxy,$miny,$maxyr,$minyr,$scale);

	# Set some dummy min/max values
	$minyr = 3000;
	$maxyr = 2000;
	$miny = 1e100;
	$maxy = -1e100;

	@lines = @{$self->{'data'}};
	$self->{'scenarios'} = ();
	$self->{'scenariolookup'} = ();

	# Split the headers and tidy
	$lines[0] =~ s/[\n\r]//g;
	(@header) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$lines[0]);
	for($c = 0; $c < @header; $c++){
		$header[$c] =~ s/(^\"|\"$)//g;
		$headers{$header[$c]} = $c;
		if($c > 0 && $header[$c] > $maxyr){ $maxyr = $header[$c]; }
		if($c > 0 && $header[$c] < $minyr){ $minyr = $header[$c]; }
	}

	# Process the rest of the lines
	for($i = 1 ; $i < @lines; $i++){
		chomp($lines[$i]);
		$lines[$i] =~ s/[\n\r]//g;
		(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$lines[$i]);
		for($c = 0; $c < @header; $c++){ $cols[$c] =~ s/(^\"|\"$)//g; }
		$self->{'scenarios'}{$cols[0]} = {};
		push(@{$self->{'scenariolookup'}},$cols[0]);
		for($c = 1; $c < @header; $c++){
			if($cols[0]){
				$self->{'scenarios'}{$cols[0]}{$header[$c]} = $cols[$c];
			}
			if($cols[$c] > $maxy){ $maxy = $cols[$c]; }
			if($cols[$c] < $miny){ $miny = $cols[$c]; }
		}
	}
	
	$self->{'xmax'} = $maxyr;
	$self->{'xmin'} = $minyr;
	$self->{'ymax'} = $maxy;
	$self->{'ymin'} = $miny;
	
	return $self;
}

sub scaleY {
	my ($self,$scale) = @_;
	my ($scenario,$y,$s);
	
	# Scale the max/min values
	$self->{'ymax'} *= $scale;
	$self->{'ymin'} *= $scale;

	for($s = 0; $s < @{$self->{'scenariolookup'}}; $s++){
		$scenario = $self->{'scenariolookup'}[$s];
		for($y = $self->{'xmin'}; $y <= $self->{'xmax'}; $y++){
			$self->{'scenarios'}{$scenario}{$y} *= $scale;
		}
	}
	
	return $self;
}

# Draw the graph
sub draw {
	my ($self, %props) = @_;
	my ($r,$w,$h,@lines,$svg,@header,%headers,$c,@cols,@rows,$i,@scenariolookup,$s,%scenarios,$scenario,$safescenario,$minyr,$maxyr,$miny,$maxy,$path,$y,$yrs,$yrange,$xpos,$ypos,$t,@pos,$circles,%ticks,@a,@b,$left,$right,$top,$bottom,$tooltip);

	$w = $props{'width'};
	$h = $props{'height'};
	
	$minyr = $self->{'xmin'};
	$maxyr = $self->{'xmax'};
	$miny = $self->{'ymin'};
	$maxy = $self->{'ymax'};

	if(!$h){ $h = $w*0.5; }

	$miny = 0;

	if($props{'xaxis-max'}){ $maxyr = $props{'xaxis-max'}; }
	if($props{'xaxis-min'}){ $minyr = $props{'xaxis-min'}; }
	if($props{'yaxis-max'}){ $maxy = $props{'yaxis-max'}; }
	if($props{'yaxis-min'}){ $miny = $props{'yaxis-min'}; }

	$yrs = $maxyr-$minyr;
	$yrange = $maxy-$miny;
	
	if(!$props{'tick'} || $props{'tick'} eq ""){ $props{'tick'} = 5; }

	# Build SVG
	$svg = "<svg width=\"".sprintf("%d",$w)."\" height=\"".sprintf("%d",$h)."\" viewBox=\"0 0 $w $h\" xmlns=\"http://www.w3.org/2000/svg\" preserveAspectRatio=\"xMinYMin meet\" overflow=\"visible\" class=\"oi-chart-main\" data-type=\"line-chart\">\n";
	$svg .= "<defs>\n";
	$svg .= "\t<style>\n";
	$svg .= "\t.series path.line { fill-opacity: 0; }\n";
	$svg .= "\t.series path.line.dotted { stroke-dasharray: 12 20 }\n";
	$svg .= "\t.series:hover path.line, .series.on path.line { stroke-width: $props{'strokehover'}; }\n";
	$svg .= "\t.series .marker { opacity:0.01; }\n";
	$svg .= "\t.series:hover .marker, .series.active .marker, .series .marker.selected { opacity:1!important; }\n";
	$svg .= "\t.series .marker:hover, .series .marker.on { r: $props{'pointhover'}px!important; fill: black; }\n";
	$svg .= "\t.grid { font-family: \"Helvetica Neue\",Helvetica,Arial,\"Lucida Grande\",sans-serif; }\n";
	$svg .= "\t.grid line { stroke: rgb(0,0,0); stroke-width: $props{'line'}; stroke-linecap: round; }\n";
	$svg .= "\t.grid.grid-x text { text-anchor: middle; dominant-baseline: hanging; transform: translateY(".($props{'tick'}*2)."px); }\n";
	$svg .= "\t.grid.grid-y text { text-anchor: end; dominant-baseline: ".($props{'yaxis-labels-baseline'}||"middle")."; transform: translateX(-".($props{'tick'}*2)."px); }\n";
	$svg .= "\t</style>\n";
	$svg .= "</defs>\n";

	$left = $props{'left'}||100;
	$right = $props{'right'}||10;
	$top = $props{'top'}||10;
	$bottom = $props{'bottom'}||30;

	# Draw grid lines
	$svg .= buildAxis(('axis'=>'y','label'=>$props{'yaxis-label'},'tick'=>5,'ticks'=>$props{'yaxis-ticks'},'line'=>$props{'xaxis-line'},'format'=>$props{'yaxis-format'},'n'=>4,'left'=>$left,'right'=>$right,'bottom'=>$bottom,'top'=>$top,'axis-lines'=>$props{'yaxis-lines'},'width'=>$w,'height'=>$h,'xmin'=>$minyr,'xmax'=>$maxyr,'ymin'=>$miny,'ymax'=>$maxy));
	$svg .= buildAxis(('axis'=>'x','label'=>$props{'xaxis-label'},'tick'=>5,'ticks'=>$props{'xaxis-ticks'},'line'=>$props{'yaxis-line'},'format'=>$props{'xaxis-format'},'left'=>$left,'right'=>$right,'bottom'=>$bottom,'top'=>$top,'spacing'=>10,'axis-lines'=>$props{'xaxis-lines'},'width'=>$w,'height'=>$h,'xmin'=>$minyr,'xmax'=>$maxyr,'ymin'=>$miny,'ymax'=>$maxy));

		
	$svg .= "<g class=\"data-layer\" role=\"table\">\n";
	for($s = 0; $s < @{$self->{'scenariolookup'}}; $s++){
		$scenario = $self->{'scenariolookup'}[$s];
		#print Dumper $self->{'scenarios'}{$scenario};
		$safescenario = safeXML($scenario);
		$t = $scenario;
		$t =~ s/[\(\)]//g;
		$t =~ s/ $self->{'flexible'}//gi;
		$path = "";
		$svg .= "<g data-scenario=\"".($self->{'scenario-props'}{$t}{'css'}||safeID($scenario)).($scenario =~ /$self->{'flexible'}/i ? "-flexible":"")."\" class=\"series series-".($s+1)."\" tabindex=\"0\" role=\"row\" aria-label=\"Series: $scenario\" data-series=\"".($s+1)."\">";
		$circles = "";
		for($y = $minyr,$i=0; $y <= $maxyr; $y++){
			if(defined($self->{'scenarios'}{$scenario}{$y})){
				@pos = getXY(('x'=>$y,'y'=>$self->{'scenarios'}{$scenario}{$y},'width'=>$w,'height'=>$h,'left'=>$left,'right'=>$right,'bottom'=>$bottom,'top'=>$top,'xmin'=>$minyr,'xmax'=>$maxyr,'ymin'=>$miny,'ymax'=>$maxy));
				$xpos = $pos[0];
				$ypos = $pos[1];
				$path .= ($i == 0 ? "M":"L")." ".sprintf("%0.2f",$xpos).",".sprintf("%0.2f",$ypos);
				if($props{'point'} > 0){
					$tooltip = ($props{'tooltip'}||"$y: $self->{'scenarios'}{$scenario}{$y}");
					$tooltip =~ s/\{\{\s*x\s*\}\}/$y/g;
					$tooltip =~ s/\{\{\s*y\s*\}\}/$self->{'scenarios'}{$scenario}{$y}/g;
					$circles .= "\t<circle class=\"marker\" cx=\"".sprintf("%0.2f",$xpos)."\" cy=\"".sprintf("%0.2f",$ypos)."\" data-y=\"$self->{'scenarios'}{$scenario}{$y}\" data-x=\"$y\" data-i=\"$i\" data-series=\"".($s+1)."\" r=\"$props{'point'}\" fill=\"".($self->{'scenario-props'}{$t}{'color'}||"#cc0935")."\" roll=\"cell\"><title>$tooltip</title></circle>\n";
				}
				$i++;
			}
		}
		$svg .= "\t<path d=\"$path\" id=\"$safescenario\" class=\"line".($scenario =~ /$self->{'flexible'}/i ? " dotted":"")."\" stroke=\"".($self->{'scenario-props'}{$t}{'color'}||"#cc0935")."\" stroke-width=\"$props{'stroke'}\" stroke-linecap=\"round\"><title>$safescenario</title></path>\n";
		$svg .= $circles;
		$svg .= "</g>\n";
	}
	$svg .= "</g>\n";
	$svg .= "</svg>\n";
	
	return $svg;
}

# Draw the graph
sub table {
	my ($self, %props) = @_;
	my ($html,$minyr,$maxyr,$miny,%ticks,$s,$t,$y,$scenario,$safescenario,$c);

	
	$minyr = $self->{'xmin'};
	$maxyr = $self->{'xmax'};

	%ticks = makeTicks($minyr,$maxyr,('spacing'=>10));

	# Build HTML
	$html = "<table>\n";

	$html .= "<tr><th>Scenario</th>";
	for($y = $ticks{'data-0'}; $y <= $maxyr; $y += 10){
		if($y ge $minyr){
			$html .= "<th>$y</th>";
		}
	}
	$html .= "</tr>\n";
	for($s = 0; $s < @{$self->{'scenariolookup'}}; $s++){
		$scenario = $self->{'scenariolookup'}[$s];
		$safescenario = safeXML($scenario).($scenario =~ /$self->{'flexible'}/i ? "&nbsp;-&nbsp;-&nbsp;-":"");
		$t = $scenario;
		$t =~ s/[\(\)]//g;
		$t =~ s/ $self->{'flexible'}//ig;

		$c = OpenInnovations::Colour->new('colour'=>($self->{'scenario-props'}{$t}{'color'}||"#cc0935"));

		$html .= "<tr data-scenario=\"".($self->{'scenario-props'}{$t}{'css'}||safeID($scenario))."".($scenario =~ /$self->{'flexible'}/i ? "-flexible":"")."\"><td ".($self->{'scenario-props'}{$t}{'css'} ? "class=\"".$self->{'scenario-props'}{$t}{'css'}."\"" : "style=\"background-color:".($c->{'hex'}).";color:".($c->{'text'})."\"")."><span>".$safescenario."</span></td>";
		
		for($y = $ticks{'data-0'}; $y <= $maxyr; $y += 10){
			if($y ge $minyr){
				$html .= "<td>".($self->{'scenarios'}{$scenario}{$y}||"")."</td>";
			}
		}
		$html .= "</tr>\n";
	}
	$html .= "</table>";
	
	return $html;
}

sub buildAxis {
	my (%props) = @_;
	my (%ticks,$svg,$t,@a,@b,$axis,$label,$temp,$tick);
	$axis = $props{'axis'}."axis";
	$tick = ($props{'tick'}||5);
	
	%ticks = makeTicks($props{($axis eq "yaxis" ? "ymin":"xmin")},$props{($axis eq "yaxis" ? "ymax":"xmax")},%props);

	$svg = "<g class=\"grid grid-$props{'axis'}\">\n";
	
	for($t = 0; $t < $ticks{'length'}; $t++){

		if($props{'axis'} eq "x"){
			$props{'x'} = $ticks{'data-'.$t};
			$props{'y'} = $props{'ymin'};
		}else{
			$props{'x'} = $props{'xmin'};
			$props{'y'} = $ticks{'data-'.$t};		
		}
		@a = getXY(%props);

		if($props{'axis'} eq "x"){
			$props{'x'} = $ticks{'data-'.$t};
			$props{'y'} = $props{'ymax'};
		}else{
			$props{'x'} = $props{'xmax'};
			$props{'y'} = $ticks{'data-'.$t};		
		}
		@b = getXY(%props);
		if($a[1] >= 0 && $a[0] >= $props{'left'}){
			if(($t == 0 && $props{'line'}) || $props{'axis-lines'}){
				$svg .= "\t<line x1=\"$a[0]\" y1=\"$a[1]\" x2=\"$b[0]\" y2=\"$b[1]\" data-left=\"$props{'left'}\"></line>\n";
			}
			if($a[0] < $props{'width'}){

				if($props{'ticks'}){
					$svg .= "\t<line class=\"tick\" x1=\"$a[0]\" y1=\"$a[1]\" x2=\"".($a[0]-($axis eq "yaxis" ? $tick : 0))."\" y2=\"".($a[1]+($axis eq "yaxis" ? 0 : $tick))."\"></line>\n";
				}
				$label = $ticks{'data-'.$t};
				if($props{'format'} && $props{'format'} eq "commify"){ $label = commify($label); }
				$svg .= "\t<text x=\"$a[0]\" y=\"$a[1]\" text-anchor=\"".($axis eq "yaxis" ? "end":"middle")."\">".$label."</text>\n";
			}
		}
	}
	$svg .= "\t<text style=\"text-anchor:middle;dominant-baseline:hanging;font-weight:bold;transform: translateY(".($props{'top'} + ($props{'height'}-$props{'top'}-$props{'bottom'})/2)."px) rotate(-90deg);\">".($props{'label'}||"")."</text>\n";

	$svg .= "</g>\n";
	return $svg;
}


# "Private" functions (they aren't technically private)

sub safeID {
	my ($str) = $_[0];
	$str =~ s/ \& / and /g;
	$str =~ s/\s/-/g;
	$str =~ tr/[A-Z]/[a-z]/;
	return $str;
}

sub safeXML {
	my ($str) = $_[0];
	$str =~ s/ \& / \&amp; /g;
	return $str;
}

sub getXY {
	my (%props) = @_;
	my ($x,$y,$xf,$yf);
	if(!$props{'left'}){ $props{'left'} = 0; }
	if(!$props{'top'}){ $props{'top'} = 0; }
	if(!$props{'right'}){ $props{'right'} = 0; }
	if(!$props{'bottom'}){ $props{'bottom'} = 0; }
	$x = $props{'left'} + (($props{'x'}-$props{'xmin'})/($props{'xmax'}-$props{'xmin'}))*($props{'width'}-$props{'left'}-$props{'right'});
	$y = $props{'top'} + (1-($props{'y'}-$props{'ymin'})/($props{'ymax'}-$props{'ymin'}))*($props{'height'}-$props{'bottom'}-$props{'top'});
	return ($x,$y);
}


##########################
# Make the tick marks.
# @param {number} mn - the minimum value
# @param {number} mx - the maximum value
sub makeTicks(){
	my ($mn,$mx,%opts) = @_;
	my ($v,$l,$i,$d,$vmx,%ticks);
	if(!defined($mx)){
		print "WARNING: No maximum value is set.\n";
		return ();
	}

	# If the range is negative we cowardly quit
	if($mn > $mx){ return (); }
	# If the min or max are not numbers we quit
	#if(isNaN(mn) || isNaN(mx)) return ticks;

	%ticks = ('length'=>0);
	if($opts{'spacing'}){ $ticks{'inc'} = $opts{'spacing'}; }
	else{ $ticks{'inc'} = defaultSpacing($mn,$mx,$opts{'n'}||5); }
	
	$vmx = $mx + $ticks{'inc'};
	for($v = ($ticks{'inc'}*int($mn/$ticks{'inc'})), $i = 0; $v <= $vmx; $v += $ticks{'inc'}, $i++){
		# If formatLabel is set we use that to format the label
		$ticks{'data-'.$i} = $v;
		$ticks{'length'}++;
	}

	if($ticks{'length'} == 0){
		print "No ticks";
		return %ticks;
	}

	$ticks{'range'} = $ticks{'data-'.($ticks{'length'}-1)} - $ticks{'data-'.0};

	return %ticks;
}

sub log10 {
	my $n = shift;
	if($n==0){
		print "Unable to take log of $n\n";
		exit;
	}
	return log($n)/log(10);
}

####################################
# Get some spacing given a minimum and maximum value
# @param {number} mn - the minimum value
# @param {number} mx - the maximum value
# @param {number} n - the minimum number of steps
sub defaultSpacing { 
	my ($mn, $mx, $n) = @_;

	my ($dv, $log10_dv, $base, $frac, @options, @distance, $imin, $tmin, $i);

	# Start off by finding the exact spacing
	$dv = abs($mx - $mn) / $n;
	
	if($dv == 0){
		print "WARNING: The spacing appears to be zero. Min = $mn, Max = $mx, n = $n. So returning a dummy spacing of '1'.\n";
		return 1;
	}
	
	# In any given order of magnitude interval, we allow the spacing to be
	# 1, 2, 5, or 10 (since all divide 10 evenly). We start off by finding the
	# log of the spacing value, then splitting this into the integer and
	# fractional part (note that for negative values, we consider the base to
	# be the next value 'down' where down is more negative, so -3.6 would be
	# split into -4 and 0.4).
	$log10_dv = log10($dv);
	$base = int($log10_dv);
	$frac = $log10_dv - $base;

	# We now want to check whether frac falls closest to 1, 2, 5, or 10 (in log
	# space). There are more efficient ways of doing this but this is just for clarity.
	@options = (1, 2, 5, 10);
	@distance = ();
	$imin = -1;
	$tmin = 1e100;
	for($i = 0; $i < @options; $i++) {
		if(!$distance[$i]){ push(@distance,""); }
		$distance[$i] = abs($frac - log10($options[$i]));
		if($distance[$i] < $tmin) {
			$tmin = $distance[$i];
			$imin = $i;
		}
	}

	# Now determine the actual spacing
	return (10 ** $base) * $options[$imin];
}

sub commify {
	my $text = reverse $_[0];
	$text =~ s/(\d\d\d)(?=\d)(?!\d*\.)/$1,/g;
	return scalar reverse $text;
}

1;